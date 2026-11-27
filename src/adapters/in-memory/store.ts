import type {
  Fund,
  Member,
  Transaction,
  AuditLog,
  Attachment,
  FundId,
  MemberId,
  TxnId,
  UserId,
} from "@/domain/types";
import { DomainError } from "@/domain/errors";
import { assertValidAmount } from "@/domain/money";
import { editTransaction, voidTransaction } from "@/domain/transaction-rules";
import type {
  AppPorts,
  Clock,
  IdGenerator,
  TokenGenerator,
  Paginated,
  PageParams,
  NewFund,
  FundPatch,
  NewTransaction,
  TxnPatch,
  TxnQuery,
} from "@/ports";

// ---- Dịch vụ mặc định ----

export const systemClock: Clock = {
  now: () => new Date(),
  today: () =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Ho_Chi_Minh",
    }).format(new Date()),
};

export const uuidGenerator: IdGenerator = {
  uuid: () => globalThis.crypto.randomUUID(),
};

export const secureTokenGenerator: TokenGenerator = {
  secureToken: () => {
    const bytes = new Uint8Array(16); // 128-bit
    globalThis.crypto.getRandomValues(bytes);
    let bin = "";
    for (const b of bytes) bin += String.fromCharCode(b);
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  },
};

function paginate<T>(items: T[], page = 1, pageSize = 20): Paginated<T> {
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const p = Math.min(Math.max(1, page), totalPages);
  const start = (p - 1) * pageSize;
  return {
    data: items.slice(start, start + pageSize),
    page: p,
    pageSize,
    totalItems,
    totalPages,
  };
}

function snapshot(txn: Transaction): unknown {
  return structuredClone(txn);
}

export interface InMemoryOptions {
  clock?: Clock;
  ids?: IdGenerator;
  tokens?: TokenGenerator;
}

/**
 * Adapter in-memory: lưu dữ liệu trong RAM, hiện thực đủ AppPorts.
 * Dùng cho giai đoạn đầu (làm UI/logic) và cho contract test.
 */
export function createInMemoryPorts(opts: InMemoryOptions = {}): AppPorts {
  const clock = opts.clock ?? systemClock;
  const ids = opts.ids ?? uuidGenerator;
  const tokens = opts.tokens ?? secureTokenGenerator;

  const funds = new Map<FundId, Fund>();
  const members = new Map<MemberId, Member>();
  const transactions = new Map<TxnId, Transaction>();
  const auditLogs: AuditLog[] = [];
  let auditSeq = 0;

  function requireFund(id: FundId): Fund {
    const f = funds.get(id);
    if (!f) throw new DomainError("NOT_FOUND", "Không tìm thấy quỹ.");
    return f;
  }

  function requireTxn(id: TxnId): Transaction {
    const t = transactions.get(id);
    if (!t) throw new DomainError("NOT_FOUND", "Không tìm thấy giao dịch.");
    return t;
  }

  function appendAudit(
    txn: Transaction,
    action: AuditLog["action"],
    oldData: unknown | null,
    actorId: UserId,
  ): void {
    auditSeq += 1;
    auditLogs.push({
      id: auditSeq,
      fundId: txn.fundId,
      transactionId: txn.id,
      action,
      oldData,
      newData: snapshot(txn),
      actorId,
      createdAt: clock.now(),
    });
  }

  const ports: AppPorts = {
    funds: {
      async create(input: NewFund): Promise<Fund> {
        const fund: Fund = {
          id: ids.uuid() as FundId,
          ownerId: input.ownerId,
          name: input.name,
          description: input.description ?? null,
          targetPerMember: input.targetPerMember ?? 0,
          bankBin: null,
          bankAccountNumber: null,
          bankAccountName: null,
          transferPrefix: null,
          memberToken: tokens.secureToken(),
          publicToken: tokens.secureToken(),
          publicEnabled: false,
          createdAt: clock.now(),
        };
        funds.set(fund.id, fund);
        return fund;
      },
      async getById(id) {
        return funds.get(id) ?? null;
      },
      async listByOwner(ownerId) {
        return [...funds.values()]
          .filter((f) => f.ownerId === ownerId)
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      },
      async getByMemberToken(token) {
        return [...funds.values()].find((f) => f.memberToken === token) ?? null;
      },
      async getByPublicToken(token) {
        const f = [...funds.values()].find((x) => x.publicToken === token);
        return f && f.publicEnabled ? f : null;
      },
      async update(id, patch: FundPatch) {
        const f = requireFund(id);
        const updated: Fund = { ...f, ...patch };
        funds.set(id, updated);
        return updated;
      },
      async rotateToken(id, which) {
        const f = requireFund(id);
        const updated: Fund =
          which === "member"
            ? { ...f, memberToken: tokens.secureToken() }
            : { ...f, publicToken: tokens.secureToken() };
        funds.set(id, updated);
        return updated;
      },
    },

    members: {
      async listByFund(fundId, opt) {
        return [...members.values()]
          .filter((m) => m.fundId === fundId)
          .filter((m) => (opt?.activeOnly ? m.isActive : true))
          .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      },
      async getById(id) {
        return members.get(id) ?? null;
      },
      async addMany(fundId, names) {
        const created: Member[] = [];
        for (const name of names) {
          const m: Member = {
            id: ids.uuid() as MemberId,
            fundId,
            name,
            isActive: true,
            createdAt: clock.now(),
          };
          members.set(m.id, m);
          created.push(m);
        }
        return created;
      },
      async update(id, patch) {
        const m = members.get(id);
        if (!m) throw new DomainError("NOT_FOUND", "Không tìm thấy thành viên.");
        const updated: Member = { ...m, ...patch };
        members.set(id, updated);
        return updated;
      },
      async hasTransactions(id) {
        return [...transactions.values()].some((t) => t.memberId === id);
      },
      async remove(id) {
        if (await ports.members.hasTransactions(id)) {
          throw new DomainError(
            "CONFLICT",
            'Thành viên đã có giao dịch, không xóa được. Hãy dùng "Ngưng tham gia".',
          );
        }
        members.delete(id);
      },
    },

    transactions: {
      async listByFund(fundId, q: TxnQuery = {}) {
        let items = [...transactions.values()].filter(
          (t) => t.fundId === fundId,
        );
        if (q.type) items = items.filter((t) => t.type === q.type);
        if (q.status) items = items.filter((t) => t.status === q.status);
        if (q.category) items = items.filter((t) => t.category === q.category);
        if (q.dateFrom) items = items.filter((t) => t.txnDate >= q.dateFrom!);
        if (q.dateTo) items = items.filter((t) => t.txnDate <= q.dateTo!);
        if (q.search) {
          const needle = q.search.toLowerCase();
          items = items.filter((t) => {
            const member = t.memberId ? members.get(t.memberId) : null;
            return [t.purpose, t.note, member?.name]
              .filter(Boolean)
              .some((s) => s!.toLowerCase().includes(needle));
          });
        }
        items.sort((a, b) => {
          if (a.txnDate !== b.txnDate) return a.txnDate < b.txnDate ? 1 : -1;
          return b.createdAt.getTime() - a.createdAt.getTime();
        });
        return paginate(items, q.page, q.pageSize);
      },
      async getById(id) {
        return transactions.get(id) ?? null;
      },
    },

    auditLogs: {
      async listByFund(fundId, page: PageParams) {
        const items = auditLogs
          .filter((a) => a.fundId === fundId)
          .sort((a, b) => b.id - a.id);
        return paginate(items, page.page, page.pageSize);
      },
    },

    uow: {
      async createTransaction(input: NewTransaction, actorId) {
        assertValidAmount(input.amount);
        const attachments: Attachment[] = (input.attachments ?? []).map(
          (a) => ({
            id: ids.uuid(),
            storagePath: a.storagePath,
            sizeBytes: a.sizeBytes,
            createdAt: clock.now(),
          }),
        );
        const txn: Transaction = {
          id: ids.uuid() as TxnId,
          fundId: input.fundId,
          type: input.type,
          amount: input.amount,
          memberId: input.memberId ?? null,
          purpose: input.purpose ?? null,
          category: input.category ?? null,
          paymentMethod: input.paymentMethod ?? null,
          note: input.note ?? null,
          noReceipt: input.noReceipt ?? false,
          noReceiptReason: input.noReceiptReason ?? null,
          txnDate: input.txnDate,
          status: "active",
          voidReason: null,
          voidedBy: null,
          voidedAt: null,
          createdBy: actorId,
          createdAt: clock.now(),
          updatedAt: null,
          attachments,
        };
        transactions.set(txn.id, txn);
        appendAudit(txn, "create", null, actorId);
        return txn;
      },

      async updateTransaction(id: TxnId, patch: TxnPatch, actorId) {
        const current = requireTxn(id);
        if (patch.amount !== undefined) assertValidAmount(patch.amount);
        const old = snapshot(current);
        const updated = editTransaction(current, patch, clock.now());
        transactions.set(id, updated);
        appendAudit(updated, "update", old, actorId);
        return updated;
      },

      async voidTransaction(id: TxnId, reason, actorId) {
        const current = requireTxn(id);
        const old = snapshot(current);
        const voided = voidTransaction(current, {
          reason,
          actorId,
          now: clock.now(),
        });
        transactions.set(id, voided);
        appendAudit(voided, "void", old, actorId);
        return voided;
      },
    },

    storage: {
      async put(fundId, bytes) {
        const storagePath = `inmem://${fundId}/${ids.uuid()}`;
        const size =
          typeof bytes.size === "number" ? bytes.size : 0;
        inMemoryBlobs.set(storagePath, bytes);
        return { storagePath, sizeBytes: size };
      },
      async signedUrl(storagePath) {
        // In-memory: trả lại chính đường dẫn (UI giai đoạn đầu chỉ cần placeholder).
        return storagePath;
      },
    },

    clock,
    ids,
    tokens,
  };

  const inMemoryBlobs = new Map<string, Blob>();

  return ports;
}
