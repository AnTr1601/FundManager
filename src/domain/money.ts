import type { Vnd } from "./types";
import { DomainError } from "./errors";

/** Số tiền tối đa cho một giao dịch (BR-01): 1 tỷ VND. */
export const MAX_AMOUNT = 1_000_000_000;

/**
 * Kiểm tra số tiền hợp lệ: số nguyên dương, ≤ 1 tỷ (BR-01).
 * Ném DomainError('VALIDATION') nếu sai.
 */
export function assertValidAmount(amount: number): asserts amount is Vnd {
  if (!Number.isInteger(amount)) {
    throw new DomainError("VALIDATION", "Số tiền phải là số nguyên (đồng).");
  }
  if (amount <= 0) {
    throw new DomainError("VALIDATION", "Số tiền phải lớn hơn 0.");
  }
  if (amount > MAX_AMOUNT) {
    throw new DomainError(
      "VALIDATION",
      "Số tiền vượt giới hạn 1.000.000.000 đ cho một giao dịch.",
    );
  }
}

export function addVnd(a: Vnd, b: Vnd): Vnd {
  return a + b;
}

export function subVnd(a: Vnd, b: Vnd): Vnd {
  return a - b;
}
