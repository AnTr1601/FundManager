import type { Transaction, MemberId, Vnd } from "./types";

export type MemberPaymentStatus = "paid" | "partial" | "unpaid";

/** Tổng số tiền một thành viên đã đóng = Σ thu(active) của thành viên đó (FR-12.1). */
export function computeMemberPaid(
  memberId: MemberId,
  txns: Transaction[],
): Vnd {
  let paid = 0;
  for (const t of txns) {
    if (
      t.status === "active" &&
      t.type === "income" &&
      t.memberId === memberId
    ) {
      paid += t.amount;
    }
  }
  return paid;
}

/**
 * Trạng thái đóng tiền theo mức đóng (FR-12.2).
 * Trả null khi quỹ không đặt mức đóng (target ≤ 0) → không hiện trạng thái (FR-12.3).
 */
export function computeMemberStatus(
  paid: Vnd,
  target: Vnd,
): MemberPaymentStatus | null {
  if (target <= 0) return null;
  if (paid >= target) return "paid";
  if (paid > 0) return "partial";
  return "unpaid";
}
