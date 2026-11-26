import type {
  Fund,
  Member,
  Transaction,
  AuditLog,
  FundId,
  MemberId,
  TxnId,
  UserId,
  Vnd,
  TxnType,
  TxnStatus,
  PaymentMethod,
  ExpenseCategory,
} from "@/domain/types";
import type { TxnEditPatch } from "@/domain/transaction-rules";

// ---- Kiểu chung ----

export interface Paginated<T> {
  data: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface PageParams {
  page: number;
  pageSize: number;
}

// ---- Quỹ ----

export interface NewFund {
  ownerId: UserId;
  name: string;
  description?: string | null;
  targetPerMember?: Vnd;
}

export interface FundPatch {
  name?: string;
  description?: string | null;
  targetPerMember?: Vnd;
  bankBin?: string | null;
  bankAccountNumber?: string | null;
  bankAccountName?: string | null;
  transferPrefix?: string | null;
  publicEnabled?: boolean;
}

export interface FundRepository {
  create(input: NewFund): Promise<Fund>;
  getById(id: FundId): Promise<Fund | null>;
  listByOwner(ownerId: UserId): Promise<Fund[]>;
  getByMemberToken(token: string): Promise<Fund | null>;
  /** Chỉ trả về quỹ khi publicEnabled = true (FR-14.6). */
  getByPublicToken(token: string): Promise<Fund | null>;
  update(id: FundId, patch: FundPatch): Promise<Fund>;
  /** Sinh token mới cho link thành viên/công khai; token cũ mất hiệu lực ngay (FR-14.4). */
  rotateToken(id: FundId, which: "member" | "public"): Promise<Fund>;
}

// ---- Thành viên ----

export interface MemberRepository {
  listByFund(
    fundId: FundId,
    opts?: { activeOnly?: boolean },
  ): Promise<Member[]>;
  getById(id: MemberId): Promise<Member | null>;
  /** Thêm hàng loạt từ danh sách tên (đã làm sạch ở tầng ứng dụng) (FR-04.2). */
  addMany(fundId: FundId, names: string[]): Promise<Member[]>;
  update(
    id: MemberId,
    patch: { name?: string; isActive?: boolean },
  ): Promise<Member>;
  /** Chỉ xóa được khi thành viên chưa có giao dịch (BR-08) — adapter tự kiểm tra. */
  remove(id: MemberId): Promise<void>;
  hasTransactions(id: MemberId): Promise<boolean>;
}

// ---- Giao dịch (chỉ đọc; ghi đi qua UnitOfWork) ----

export interface TxnQuery {
  page?: number;
  pageSize?: number;
  type?: TxnType;
  status?: TxnStatus;
  category?: ExpenseCategory;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

export interface TransactionRepository {
  listByFund(fundId: FundId, q?: TxnQuery): Promise<Paginated<Transaction>>;
  getById(id: TxnId): Promise<Transaction | null>;
  // KHÔNG có delete(): không xóa được giao dịch (BR-03).
}

// ---- Nhật ký (chỉ-thêm; ghi đi qua UnitOfWork) ----

export interface AuditLogRepository {
  listByFund(fundId: FundId, page: PageParams): Promise<Paginated<AuditLog>>;
  // KHÔNG có update()/delete(): append-only (BR-04).
}

// ---- Unit of Work: ghi giao dịch + nhật ký nguyên tử (NFR-I2) ----

export interface NewTransaction {
  fundId: FundId;
  type: TxnType;
  amount: Vnd;
  memberId?: MemberId | null;
  purpose?: string | null;
  category?: ExpenseCategory | null;
  paymentMethod?: PaymentMethod | null;
  note?: string | null;
  noReceipt?: boolean;
  noReceiptReason?: string | null;
  txnDate: string;
  attachments?: { storagePath: string; sizeBytes: number }[];
}

export type TxnPatch = TxnEditPatch;

export interface FundUnitOfWork {
  /** Tạo giao dịch + ghi nhật ký 'create' nguyên tử. */
  createTransaction(input: NewTransaction, actorId: UserId): Promise<Transaction>;
  /** Sửa giao dịch + ghi nhật ký 'update' (old/new) nguyên tử. */
  updateTransaction(
    id: TxnId,
    patch: TxnPatch,
    actorId: UserId,
  ): Promise<Transaction>;
  /** Hủy giao dịch + ghi nhật ký 'void' nguyên tử. */
  voidTransaction(
    id: TxnId,
    reason: string,
    actorId: UserId,
  ): Promise<Transaction>;
}
