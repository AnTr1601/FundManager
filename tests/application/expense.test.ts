import { describe, it, expect } from "vitest";
import { createInMemoryPorts } from "@/adapters/in-memory/store";
import {
  recordExpense,
  lastExpenseCategory,
  getFundTransactions,
  type AttachmentInput,
} from "@/application/transactions";
import { DomainError } from "@/domain/errors";
import type { Clock } from "@/ports";
import type { FundId, UserId } from "@/domain/types";

const OWNER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" as UserId;

const fixedClock: Clock = {
  now: () => new Date("2026-11-27T12:00:00+07:00"),
  today: () => "2026-11-27",
};

const photo: AttachmentInput[] = [{ storagePath: "inmem://x", sizeBytes: 1000 }];

/** Quỹ có sẵn số dư `balance` (từ một khoản thu tiền mặt). */
async function setup(balance: number) {
  const ports = createInMemoryPorts({ clock: fixedClock });
  const fund = await ports.funds.create({ ownerId: OWNER, name: "Quỹ" });
  const [m] = await ports.members.addMany(fund.id, ["An"]);
  if (balance > 0) {
    await ports.uow.createTransaction(
      {
        fundId: fund.id,
        type: "income",
        amount: balance,
        memberId: m!.id,
        paymentMethod: "cash",
        txnDate: "2026-11-20",
      },
      OWNER,
    );
  }
  return { ports, fundId: fund.id as FundId };
}

function eraw(over: Record<string, unknown> = {}) {
  return {
    amount: 30_000,
    purpose: "Mua nước",
    category: "food",
    txnDate: "2026-11-20",
    ...over,
  };
}

describe("recordExpense — quy tắc hóa đơn (AT-11/AT-12)", () => {
  it("không ảnh và không khai 'không hóa đơn' → bị chặn", async () => {
    const { ports, fundId } = await setup(100_000);
    await expect(
      recordExpense(ports, OWNER, fundId, eraw(), [], true),
    ).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("tick 'không hóa đơn' + lý do ≥5 → lưu, giữ cờ noReceipt", async () => {
    const { ports, fundId } = await setup(100_000);
    const t = await recordExpense(
      ports,
      OWNER,
      fundId,
      eraw({ noReceipt: true, noReceiptReason: "Mua ở chợ quê" }),
      [],
      true,
    );
    expect(t.noReceipt).toBe(true);
    expect(t.noReceiptReason).toBe("Mua ở chợ quê");
  });

  it("'không hóa đơn' nhưng lý do < 5 ký tự → bị chặn", async () => {
    const { ports, fundId } = await setup(100_000);
    await expect(
      recordExpense(
        ports,
        OWNER,
        fundId,
        eraw({ noReceipt: true, noReceiptReason: "ab" }),
        [],
        true,
      ),
    ).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("có ảnh hóa đơn → lưu được", async () => {
    const { ports, fundId } = await setup(100_000);
    const t = await recordExpense(ports, OWNER, fundId, eraw(), photo, true);
    expect(t.type).toBe("expense");
    expect(t.attachments).toHaveLength(1);
  });
});

describe("recordExpense — vượt số dư (AT-13)", () => {
  it("số dư 50.000, chi 80.000: chặn khi chưa xác nhận; xác nhận → số dư −30.000", async () => {
    const { ports, fundId } = await setup(50_000);
    const over = eraw({
      amount: 80_000,
      noReceipt: true,
      noReceiptReason: "Ứng trước",
    });

    await expect(
      recordExpense(ports, OWNER, fundId, over, [], false),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    await recordExpense(ports, OWNER, fundId, over, [], true);
    const { totals } = await getFundTransactions(ports, fundId);
    expect(totals.balance).toBe(-30_000);
  });
});

describe("recordExpense — các trường & danh mục gần nhất", () => {
  it("từ chối số tiền sai, mục đích trống, danh mục sai, ngày tương lai", async () => {
    const { ports, fundId } = await setup(100_000);
    const bads = [
      eraw({ amount: 0 }),
      eraw({ amount: -5000 }),
      eraw({ amount: "abc" }),
      eraw({ purpose: "" }),
      eraw({ category: "bad" }),
      eraw({ txnDate: "2999-01-01", noReceipt: true, noReceiptReason: "xyz12" }),
    ];
    for (const bad of bads) {
      await expect(
        recordExpense(ports, OWNER, fundId, bad, photo, true),
      ).rejects.toThrow(DomainError);
    }
  });

  it("lastExpenseCategory trả danh mục của khoản chi gần nhất", async () => {
    const { ports, fundId } = await setup(100_000);
    expect(await lastExpenseCategory(ports, fundId)).toBeNull();
    await recordExpense(
      ports,
      OWNER,
      fundId,
      eraw({ category: "transport" }),
      photo,
      true,
    );
    expect(await lastExpenseCategory(ports, fundId)).toBe("transport");
  });
});
