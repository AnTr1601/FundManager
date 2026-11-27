import { describe, it, expect } from "vitest";
import {
  voidTransaction,
  editTransaction,
  assertReceiptRule,
  assertTxnDateNotFuture,
} from "@/domain/transaction-rules";
import { DomainError } from "@/domain/errors";
import type { UserId } from "@/domain/types";
import { makeTxn, makeExpense } from "../support/factories";

const actor = "user-9" as UserId;
const now = new Date("2026-11-26T10:00:00Z");

describe("voidTransaction (FR-09)", () => {
  it("chuyển sang voided, lưu lý do/người/thời điểm", () => {
    const txn = makeTxn({ amount: 100_000 });
    const v = voidTransaction(txn, { reason: "Ghi nhầm số tiền", actorId: actor, now });
    expect(v.status).toBe("voided");
    expect(v.voidReason).toBe("Ghi nhầm số tiền");
    expect(v.voidedBy).toBe(actor);
    expect(v.voidedAt).toEqual(now);
  });

  it("bắt buộc lý do 5–200 ký tự", () => {
    const txn = makeTxn();
    expect(() => voidTransaction(txn, { reason: "x", actorId: actor, now })).toThrow(DomainError);
  });

  it("không hủy được giao dịch đã hủy", () => {
    const txn = makeTxn({ status: "voided", voidReason: "cũ" });
    expect(() => voidTransaction(txn, { reason: "lý do hợp lệ", actorId: actor, now })).toThrow(
      DomainError,
    );
  });
});

describe("editTransaction (FR-08)", () => {
  it("sửa số tiền của giao dịch active, đặt updatedAt", () => {
    const txn = makeTxn({ amount: 150_000 });
    const e = editTransaction(txn, { amount: 1_500_000 }, now);
    expect(e.amount).toBe(1_500_000);
    expect(e.updatedAt).toEqual(now);
  });

  it("cấm đổi loại giao dịch (type)", () => {
    const txn = makeTxn({ type: "income" });
    expect(() => editTransaction(txn, { type: "expense" }, now)).toThrow(DomainError);
  });

  it("không sửa được giao dịch đã hủy", () => {
    const txn = makeTxn({ status: "voided", voidReason: "cũ" });
    expect(() => editTransaction(txn, { amount: 1 }, now)).toThrow(DomainError);
  });
});

describe("assertReceiptRule (BR-05, BR-06)", () => {
  it("chi: bắt buộc ảnh, trừ khi noReceipt + lý do ≥5", () => {
    expect(() =>
      assertReceiptRule({ type: "expense", paymentMethod: null, hasAttachment: false, noReceipt: false, noReceiptReason: null }),
    ).toThrow(DomainError);
    expect(() =>
      assertReceiptRule({ type: "expense", paymentMethod: null, hasAttachment: true, noReceipt: false, noReceiptReason: null }),
    ).not.toThrow();
    expect(() =>
      assertReceiptRule({ type: "expense", paymentMethod: null, hasAttachment: false, noReceipt: true, noReceiptReason: "Mua ở chợ không có hóa đơn" }),
    ).not.toThrow();
    expect(() =>
      assertReceiptRule({ type: "expense", paymentMethod: null, hasAttachment: false, noReceipt: true, noReceiptReason: "ngắn" }),
    ).toThrow(DomainError);
  });

  it("thu chuyển khoản bắt buộc ảnh; tiền mặt thì không", () => {
    expect(() =>
      assertReceiptRule({ type: "income", paymentMethod: "transfer", hasAttachment: false, noReceipt: false, noReceiptReason: null }),
    ).toThrow(DomainError);
    expect(() =>
      assertReceiptRule({ type: "income", paymentMethod: "cash", hasAttachment: false, noReceipt: false, noReceiptReason: null }),
    ).not.toThrow();
  });
});

describe("assertTxnDateNotFuture (BR-07)", () => {
  it("từ chối ngày trong tương lai", () => {
    expect(() => assertTxnDateNotFuture("2026-11-27", "2026-11-26")).toThrow(DomainError);
  });
  it("chấp nhận hôm nay và quá khứ", () => {
    expect(() => assertTxnDateNotFuture("2026-11-26", "2026-11-26")).not.toThrow();
    expect(() => assertTxnDateNotFuture("2026-01-01", "2026-11-26")).not.toThrow();
  });
});
