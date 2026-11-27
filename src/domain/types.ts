/**
 * Kiểu dữ liệu miền — thuần, không phụ thuộc Next.js/Supabase.
 * Ánh xạ 1-1 với bảng dữ liệu ở Bước 3 §6.
 */

// Branded id: tránh lẫn id giữa các bảng (an toàn kiểu).
export type FundId = string & { readonly __brand: "FundId" };
export type MemberId = string & { readonly __brand: "MemberId" };
export type TxnId = string & { readonly __brand: "TxnId" };
export type UserId = string & { readonly __brand: "UserId" };

/** Số nguyên VND. Không dùng số thực (NFR-I1). */
export type Vnd = number;

export type TxnType = "income" | "expense";
export type PaymentMethod = "transfer" | "cash";
export type TxnStatus = "active" | "voided";

export type ExpenseCategory =
  | "food" // Ăn uống
  | "printing" // In ấn và văn phòng phẩm
  | "gift" // Quà tặng
  | "transport" // Di chuyển
  | "charity" // Thiện nguyện
  | "other"; // Khác

export interface Fund {
  id: FundId;
  ownerId: UserId;
  name: string; // 1–100 ký tự
  description: string | null; // ≤ 500
  targetPerMember: Vnd; // ≥ 0; 0 = không đặt mức đóng
  // Thông tin nhận tiền cho VietQR (FR-19). null = chưa gắn ⇒ không hiện QR.
  bankBin: string | null;
  bankAccountNumber: string | null;
  bankAccountName: string | null;
  transferPrefix: string | null; // tiền tố nội dung CK, vd 'QUY12A1'
  memberToken: string; // ≥128-bit ngẫu nhiên
  publicToken: string;
  publicEnabled: boolean; // mặc định false
  createdAt: Date;
}

export interface Member {
  id: MemberId;
  fundId: FundId;
  name: string; // 1–100 ký tự
  isActive: boolean; // false = ngưng tham gia
  createdAt: Date;
}

export interface Attachment {
  id: string;
  storagePath: string; // đường dẫn trong kho riêng tư
  sizeBytes: number; // ≤ 512_000 (sau nén)
  createdAt: Date;
}

export interface Transaction {
  id: TxnId;
  fundId: FundId;
  type: TxnType; // không đổi sau khi tạo
  amount: Vnd; // > 0, ≤ 1_000_000_000
  memberId: MemberId | null; // bắt buộc nếu income
  purpose: string | null; // bắt buộc nếu expense
  category: ExpenseCategory | null; // bắt buộc nếu expense
  paymentMethod: PaymentMethod | null; // bắt buộc nếu income
  note: string | null;
  noReceipt: boolean;
  noReceiptReason: string | null;
  txnDate: string; // 'YYYY-MM-DD', ≤ hôm nay
  status: TxnStatus;
  voidReason: string | null;
  voidedBy: UserId | null;
  voidedAt: Date | null;
  createdBy: UserId; // máy chủ gán (BR-10)
  createdAt: Date;
  updatedAt: Date | null;
  attachments: Attachment[]; // ≤ 3
}

export type AuditAction = "create" | "update" | "void";

export interface AuditLog {
  id: number;
  fundId: FundId;
  transactionId: TxnId;
  action: AuditAction;
  oldData: unknown | null; // null nếu create
  newData: unknown;
  actorId: UserId;
  createdAt: Date;
}
