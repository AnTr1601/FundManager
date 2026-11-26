import type {
  Transaction,
  TxnId,
  FundId,
  MemberId,
  UserId,
} from "@/domain/types";

let counter = 0;

/** Dựng một Transaction mẫu (mặc định: khoản thu tiền mặt active). */
export function makeTxn(partial: Partial<Transaction> = {}): Transaction {
  counter += 1;
  return {
    id: `txn-${counter}` as TxnId,
    fundId: "fund-1" as FundId,
    type: "income",
    amount: 100_000,
    memberId: "mem-1" as MemberId,
    purpose: null,
    category: null,
    paymentMethod: "cash",
    note: null,
    noReceipt: false,
    noReceiptReason: null,
    txnDate: "2026-11-21",
    status: "active",
    voidReason: null,
    voidedBy: null,
    voidedAt: null,
    createdBy: "user-1" as UserId,
    createdAt: new Date("2026-11-21T00:00:00Z"),
    updatedAt: null,
    attachments: [],
    ...partial,
  };
}

/** Tiện ích: dựng một khoản chi mẫu. */
export function makeExpense(partial: Partial<Transaction> = {}): Transaction {
  return makeTxn({
    type: "expense",
    memberId: null,
    purpose: "Mua đồ",
    category: "other",
    paymentMethod: null,
    ...partial,
  });
}
