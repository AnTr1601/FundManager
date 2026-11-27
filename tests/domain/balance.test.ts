import { describe, it, expect } from "vitest";
import { computeTotals } from "@/domain/balance";
import { makeTxn, makeExpense } from "../support/factories";

describe("computeTotals (BR-02)", () => {
  it("số dư = Σ thu(active) − Σ chi(active), bỏ qua giao dịch đã hủy (AT-22)", () => {
    const txns = [
      makeTxn({ type: "income", amount: 4_000_000 }),
      makeExpense({ amount: 1_250_000, category: "printing" }),
      makeTxn({
        type: "income",
        amount: 100_000,
        status: "voided",
        voidReason: "ghi nhầm",
      }),
    ];
    expect(computeTotals(txns)).toEqual({
      income: 4_000_000,
      expense: 1_250_000,
      balance: 2_750_000,
    });
  });

  it("quỹ rỗng → tất cả 0", () => {
    expect(computeTotals([])).toEqual({ income: 0, expense: 0, balance: 0 });
  });

  it("số dư âm khi chi vượt thu (thủ quỹ ứng trước)", () => {
    const txns = [
      makeTxn({ type: "income", amount: 50_000 }),
      makeExpense({ amount: 80_000 }),
    ];
    expect(computeTotals(txns).balance).toBe(-30_000);
  });
});
