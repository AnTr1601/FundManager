import { z } from "zod";
import type { AppPorts } from "@/ports";
import type {
  ExpenseCategory,
  FundId,
  MemberId,
  Transaction,
  UserId,
  Vnd,
} from "@/domain/types";
import { DomainError } from "@/domain/errors";
import { requireOwnedFund } from "./guard";
import {
  assertReceiptRule,
  assertTxnDateNotFuture,
} from "@/domain/transaction-rules";
import { computeMemberPaid } from "@/domain/payment-status";
import { computeTotals, type FundTotals } from "@/domain/balance";
import { formatMoney } from "@/lib/format";

export interface AttachmentInput {
  storagePath: string;
  sizeBytes: number;
}

/** Kiểm tra dữ liệu ghi khoản thu ở biên ứng dụng (FR-05; AT-10/AT-14). */
export const incomeSchema = z.object({
  memberId: z.string().min(1, "Vui lòng chọn thành viên đóng tiền."),
  amount: z.coerce
    .number()
    .int("Số tiền phải là số nguyên.")
    .positive("Số tiền phải lớn hơn 0.")
    .max(1_000_000_000, "Số tiền quá lớn."),
  paymentMethod: z.enum(["transfer", "cash"]),
  txnDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày không hợp lệ."),
  note: z.string().trim().max(500, "Ghi chú tối đa 500 ký tự.").optional(),
});

/** Ghi một khoản thu (đóng quỹ). Chủ quỹ, thành viên thuộc quỹ, quy tắc ảnh/ngày. */
export async function recordIncome(
  ports: AppPorts,
  ownerId: UserId,
  fundId: FundId,
  raw: unknown,
  attachments: AttachmentInput[],
): Promise<Transaction> {
  await requireOwnedFund(ports, ownerId, fundId);

  const parsed = incomeSchema.safeParse(raw);
  if (!parsed.success) {
    throw new DomainError(
      "VALIDATION",
      parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ.",
    );
  }
  const f = parsed.data;

  const member = await ports.members.getById(f.memberId as MemberId);
  if (!member || member.fundId !== fundId) {
    throw new DomainError("VALIDATION", "Thành viên không thuộc quỹ này.");
  }

  assertTxnDateNotFuture(f.txnDate, ports.clock.today());
  assertReceiptRule({
    type: "income",
    paymentMethod: f.paymentMethod,
    hasAttachment: attachments.length > 0,
    noReceipt: false,
    noReceiptReason: null,
  });

  return ports.uow.createTransaction(
    {
      fundId,
      type: "income",
      amount: f.amount,
      memberId: f.memberId as MemberId,
      paymentMethod: f.paymentMethod,
      note: f.note ?? null,
      txnDate: f.txnDate,
      attachments,
    },
    ownerId,
  );
}

export interface IncomeMemberRow {
  id: MemberId;
  name: string;
  paid: Vnd;
  /** Số còn thiếu để prefill form (0 nếu quỹ không đặt mức đóng). */
  remaining: Vnd;
}

/** Danh sách thành viên đang tham gia kèm số còn thiếu (prefill form thu). */
export async function listMembersForIncome(
  ports: AppPorts,
  fundId: FundId,
): Promise<IncomeMemberRow[]> {
  const fund = await ports.funds.getById(fundId);
  const target = fund?.targetPerMember ?? 0;
  const members = await ports.members.listByFund(fundId, { activeOnly: true });
  const page = await ports.transactions.listByFund(fundId, { pageSize: 1000 });
  return members.map((m) => {
    const paid = computeMemberPaid(m.id, page.data);
    const remaining = target > 0 ? Math.max(0, target - paid) : 0;
    return { id: m.id, name: m.name, paid, remaining };
  });
}

export interface FundTransactionsView {
  totals: FundTotals;
  transactions: Transaction[];
}

/** Giao dịch + số dư của một quỹ (mới nhất trước). */
export async function getFundTransactions(
  ports: AppPorts,
  fundId: FundId,
): Promise<FundTransactionsView> {
  const page = await ports.transactions.listByFund(fundId, { pageSize: 1000 });
  return { totals: computeTotals(page.data), transactions: page.data };
}

/** Kiểm tra dữ liệu ghi khoản chi (FR-06; AT-11/AT-12). */
export const expenseSchema = z.object({
  amount: z.coerce
    .number()
    .int("Số tiền phải là số nguyên.")
    .positive("Số tiền phải lớn hơn 0.")
    .max(1_000_000_000, "Số tiền quá lớn."),
  purpose: z
    .string()
    .trim()
    .min(1, "Mục đích không được để trống.")
    .max(200, "Mục đích tối đa 200 ký tự."),
  category: z.enum([
    "food",
    "printing",
    "gift",
    "transport",
    "charity",
    "other",
  ]),
  paymentMethod: z.enum(["transfer", "cash"]).optional(),
  txnDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày không hợp lệ."),
  note: z.string().trim().max(500, "Ghi chú tối đa 500 ký tự.").optional(),
  noReceipt: z.boolean().optional().default(false),
  noReceiptReason: z
    .string()
    .trim()
    .max(200, "Lý do tối đa 200 ký tự.")
    .optional(),
});

/**
 * Ghi một khoản chi. Bắt buộc ảnh hóa đơn trừ khi khai "không có hóa đơn" + lý do
 * (assertReceiptRule). Chi vượt số dư cần allowOverspend = true để xác nhận (AT-13).
 */
export async function recordExpense(
  ports: AppPorts,
  ownerId: UserId,
  fundId: FundId,
  raw: unknown,
  attachments: AttachmentInput[],
  allowOverspend: boolean,
): Promise<Transaction> {
  await requireOwnedFund(ports, ownerId, fundId);

  const parsed = expenseSchema.safeParse(raw);
  if (!parsed.success) {
    throw new DomainError(
      "VALIDATION",
      parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ.",
    );
  }
  const f = parsed.data;

  assertTxnDateNotFuture(f.txnDate, ports.clock.today());
  assertReceiptRule({
    type: "expense",
    paymentMethod: f.paymentMethod ?? null,
    hasAttachment: attachments.length > 0,
    noReceipt: f.noReceipt,
    noReceiptReason: f.noReceiptReason ?? null,
  });

  if (!allowOverspend) {
    const { totals } = await getFundTransactions(ports, fundId);
    if (f.amount > totals.balance) {
      throw new DomainError(
        "CONFLICT",
        `Số tiền vượt số dư hiện tại (${formatMoney(totals.balance)}). Hãy tích "Xác nhận chi vượt số dư" để tiếp tục.`,
        { overspend: true },
      );
    }
  }

  return ports.uow.createTransaction(
    {
      fundId,
      type: "expense",
      amount: f.amount,
      purpose: f.purpose,
      category: f.category,
      paymentMethod: f.paymentMethod ?? null,
      note: f.note ?? null,
      noReceipt: f.noReceipt,
      noReceiptReason: f.noReceipt ? (f.noReceiptReason ?? null) : null,
      txnDate: f.txnDate,
      attachments,
    },
    ownerId,
  );
}

/** Danh mục của khoản chi gần nhất, để prefill form (FR-06.3). */
export async function lastExpenseCategory(
  ports: AppPorts,
  fundId: FundId,
): Promise<ExpenseCategory | null> {
  const page = await ports.transactions.listByFund(fundId, {
    type: "expense",
    pageSize: 1,
  });
  return page.data[0]?.category ?? null;
}
