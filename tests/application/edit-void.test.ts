import { describe, it, expect } from "vitest";
import { createInMemoryPorts } from "@/adapters/in-memory/store";
import {
  editFundTransaction,
  voidFundTransaction,
  listAuditLog,
  getFundTransactions,
} from "@/application/transactions";
import { DomainError } from "@/domain/errors";
import type { Clock } from "@/ports";
import type { FundId, UserId } from "@/domain/types";

const OWNER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" as UserId;
const fixedClock: Clock = {
  now: () => new Date("2026-11-27T12:00:00+07:00"),
  today: () => "2026-11-27",
};

async function setup() {
  const ports = createInMemoryPorts({ clock: fixedClock });
  const fund = await ports.funds.create({ ownerId: OWNER, name: "Quỹ" });
  const [m] = await ports.members.addMany(fund.id, ["An"]);
  const txn = await ports.uow.createTransaction(
    {
      fundId: fund.id,
      type: "income",
      amount: 150_000,
      memberId: m!.id,
      paymentMethod: "cash",
      txnDate: "2026-11-20",
    },
    OWNER,
  );
  return { ports, fundId: fund.id as FundId, txnId: txn.id };
}

describe("editFundTransaction (AT-16)", () => {
  it("sửa 150.000→1.500.000: cập nhật số dư + nhật ký cũ/mới + nhãn Đã sửa", async () => {
    const { ports, fundId, txnId } = await setup();
    const updated = await editFundTransaction(ports, OWNER, fundId, txnId, {
      amount: 1_500_000,
      txnDate: "2026-11-20",
    });
    expect(updated.amount).toBe(1_500_000);
    expect(updated.updatedAt).not.toBeNull();

    const { totals } = await getFundTransactions(ports, fundId);
    expect(totals.balance).toBe(1_500_000);

    const log = await listAuditLog(ports, fundId);
    const upd = log.find((a) => a.action === "update")!;
    expect(upd.oldData).not.toBeNull();
    expect(upd.newData).not.toBeNull();
  });

  it("từ chối số tiền 0 hoặc ngày tương lai", async () => {
    const { ports, fundId, txnId } = await setup();
    await expect(
      editFundTransaction(ports, OWNER, fundId, txnId, {
        amount: 0,
        txnDate: "2026-11-20",
      }),
    ).rejects.toThrow(DomainError);
    await expect(
      editFundTransaction(ports, OWNER, fundId, txnId, {
        amount: 1000,
        txnDate: "2999-01-01",
      }),
    ).rejects.toThrow(DomainError);
  });

  it("từ chối sửa giao dịch không thuộc quỹ", async () => {
    const { ports, txnId } = await setup();
    const other = await ports.funds.create({ ownerId: OWNER, name: "Quỹ 2" });
    await expect(
      editFundTransaction(ports, OWNER, other.id, txnId, {
        amount: 1000,
        txnDate: "2026-11-20",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("voidFundTransaction (AT-17/AT-18)", () => {
  it("hủy không lý do / lý do ngắn → chặn", async () => {
    const { ports, fundId, txnId } = await setup();
    await expect(
      voidFundTransaction(ports, OWNER, fundId, txnId, ""),
    ).rejects.toThrow(DomainError);
    await expect(
      voidFundTransaction(ports, OWNER, fundId, txnId, "ab"),
    ).rejects.toThrow(DomainError);
  });

  it("hủy có lý do → voided, không tính số dư, ghi log void", async () => {
    const { ports, fundId, txnId } = await setup();
    const voided = await voidFundTransaction(
      ports,
      OWNER,
      fundId,
      txnId,
      "Ghi nhầm, hủy lại",
    );
    expect(voided.status).toBe("voided");

    const { totals } = await getFundTransactions(ports, fundId);
    expect(totals.balance).toBe(0);

    const log = await listAuditLog(ports, fundId);
    expect(log.some((a) => a.action === "void")).toBe(true);
  });

  it("không sửa được giao dịch đã hủy", async () => {
    const { ports, fundId, txnId } = await setup();
    await voidFundTransaction(ports, OWNER, fundId, txnId, "huy giao dich");
    await expect(
      editFundTransaction(ports, OWNER, fundId, txnId, {
        amount: 1000,
        txnDate: "2026-11-20",
      }),
    ).rejects.toThrow(DomainError);
  });
});
