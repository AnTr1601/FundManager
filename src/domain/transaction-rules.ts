import type {
  Transaction,
  TxnType,
  PaymentMethod,
  ExpenseCategory,
  MemberId,
  UserId,
  Vnd,
} from "./types";
import { DomainError } from "./errors";

/** Các trường được phép sửa của một giao dịch (không gồm `type` — cấm đổi). */
export interface TxnEditPatch {
  type?: TxnType; // chỉ để phát hiện yêu cầu đổi type (sẽ bị từ chối)
  amount?: Vnd;
  memberId?: MemberId | null;
  purpose?: string | null;
  category?: ExpenseCategory | null;
  paymentMethod?: PaymentMethod | null;
  note?: string | null;
  txnDate?: string;
  noReceipt?: boolean;
  noReceiptReason?: string | null;
}

/**
 * Hủy giao dịch (FR-09): chỉ giao dịch active mới hủy được, bắt buộc lý do 5–200 ký tự.
 * KHÔNG có hàm xóa giao dịch ở bất kỳ đâu (BR-03).
 */
export function voidTransaction(
  txn: Transaction,
  params: { reason: string; actorId: UserId; now: Date },
): Transaction {
  if (txn.status !== "active") {
    throw new DomainError("RULE_VIOLATION", "Giao dịch đã hủy, không thể hủy lại.");
  }
  const reason = params.reason.trim();
  if (reason.length < 5 || reason.length > 200) {
    throw new DomainError("VALIDATION", "Lý do hủy phải từ 5 đến 200 ký tự.");
  }
  return {
    ...txn,
    status: "voided",
    voidReason: reason,
    voidedBy: params.actorId,
    voidedAt: params.now,
  };
}

/**
 * Sửa giao dịch đang hiệu lực (FR-08). Cấm đổi loại (type). Không sửa được giao dịch đã hủy.
 * Trả về bản mới; người gọi (UnitOfWork) chịu trách nhiệm lưu bản cũ vào nhật ký.
 */
export function editTransaction(
  txn: Transaction,
  patch: TxnEditPatch,
  now: Date,
): Transaction {
  if (txn.status !== "active") {
    throw new DomainError("RULE_VIOLATION", "Không sửa được giao dịch đã hủy.");
  }
  if (patch.type !== undefined && patch.type !== txn.type) {
    throw new DomainError("RULE_VIOLATION", "Không được đổi loại giao dịch (thu/chi).");
  }
  const { type: _ignored, ...fields } = patch;
  void _ignored;
  return { ...txn, ...fields, updatedAt: now };
}

/**
 * Quy tắc chứng từ (BR-05, BR-06):
 * - Chi: bắt buộc ảnh, trừ khi khai "không có hóa đơn" kèm lý do ≥ 5 ký tự.
 * - Thu chuyển khoản: bắt buộc ảnh. Thu tiền mặt: không bắt buộc.
 */
export function assertReceiptRule(params: {
  type: TxnType;
  paymentMethod: PaymentMethod | null;
  hasAttachment: boolean;
  noReceipt: boolean;
  noReceiptReason: string | null;
}): void {
  if (params.type === "expense") {
    if (params.hasAttachment) return;
    if (params.noReceipt && (params.noReceiptReason?.trim().length ?? 0) >= 5) {
      return;
    }
    throw new DomainError(
      "VALIDATION",
      'Vui lòng đính kèm ảnh hóa đơn, hoặc tick "Không có hóa đơn" kèm lý do.',
    );
  }
  // income
  if (params.paymentMethod === "transfer" && !params.hasAttachment) {
    throw new DomainError("VALIDATION", "Khoản thu chuyển khoản phải có ảnh.");
  }
}

/** Ngày giao dịch không được ở tương lai (BR-07). So sánh chuỗi 'YYYY-MM-DD'. */
export function assertTxnDateNotFuture(txnDate: string, today: string): void {
  if (txnDate > today) {
    throw new DomainError("VALIDATION", "Ngày giao dịch không được ở tương lai.");
  }
}
