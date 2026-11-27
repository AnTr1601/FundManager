import type { Transaction, Vnd } from "./types";

export interface FundTotals {
  income: Vnd;
  expense: Vnd;
  balance: Vnd;
}

/**
 * Số dư luôn được TÍNH từ giao dịch, không lưu riêng (BR-02):
 * balance = Σ thu(active) − Σ chi(active). Có thể âm (thủ quỹ ứng trước).
 */
export function computeTotals(txns: Transaction[]): FundTotals {
  let income = 0;
  let expense = 0;
  for (const t of txns) {
    if (t.status !== "active") continue;
    if (t.type === "income") income += t.amount;
    else expense += t.amount;
  }
  return { income, expense, balance: income - expense };
}
