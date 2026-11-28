import { describe, it, expect } from "vitest";
import { createInMemoryPorts } from "@/adapters/in-memory/store";
import {
  recordIncome,
  listMembersForIncome,
  getFundTransactions,
  type AttachmentInput,
} from "@/application/transactions";
import { DomainError } from "@/domain/errors";
import type { Clock } from "@/ports";
import type { UserId } from "@/domain/types";

const OWNER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" as UserId;

const fixedClock: Clock = {
  now: () => new Date("2026-11-27T12:00:00+07:00"),
  today: () => "2026-11-27",
};

const photo: AttachmentInput[] = [{ storagePath: "inmem://x", sizeBytes: 1000 }];

async function setup() {
  const ports = createInMemoryPorts({ clock: fixedClock });
  const fund = await ports.funds.create({
    ownerId: OWNER,
    name: "Quỹ",
    targetPerMember: 100_000,
  });
  const [m] = await ports.members.addMany(fund.id, ["An"]);
  return { ports, fundId: fund.id, memberId: m!.id };
}

function raw(memberId: string, over: Record<string, unknown> = {}) {
  return {
    memberId,
    amount: 100_000,
    paymentMethod: "cash",
    txnDate: "2026-11-20",
    ...over,
  };
}

describe("recordIncome — quy tắc chứng từ (AT-07)", () => {
  it("chuyển khoản KHÔNG ảnh → bị chặn", async () => {
    const { ports, fundId, memberId } = await setup();
    await expect(
      recordIncome(ports, OWNER, fundId, raw(memberId, { paymentMethod: "transfer" }), []),
    ).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("chuyển khoản CÓ ảnh → lưu được", async () => {
    const { ports, fundId, memberId } = await setup();
    const t = await recordIncome(
      ports,
      OWNER,
      fundId,
      raw(memberId, { paymentMethod: "transfer" }),
      photo,
    );
    expect(t.attachments).toHaveLength(1);
  });

  it("tiền mặt KHÔNG ảnh → lưu, nhãn tiền mặt, số dư +100.000 (AT-08)", async () => {
    const { ports, fundId, memberId } = await setup();
    const t = await recordIncome(ports, OWNER, fundId, raw(memberId), []);
    expect(t.paymentMethod).toBe("cash");
    const { totals } = await getFundTransactions(ports, fundId);
    expect(totals.balance).toBe(100_000);
  });
});

describe("recordIncome — số tiền & ngày (AT-10/AT-14)", () => {
  it("từ chối số tiền 0, âm, không phải số", async () => {
    const { ports, fundId, memberId } = await setup();
    for (const amount of [0, -5000, "abc"]) {
      await expect(
        recordIncome(ports, OWNER, fundId, raw(memberId, { amount }), []),
      ).rejects.toThrow(DomainError);
    }
  });

  it("từ chối ngày tương lai", async () => {
    const { ports, fundId, memberId } = await setup();
    await expect(
      recordIncome(ports, OWNER, fundId, raw(memberId, { txnDate: "2999-01-01" }), []),
    ).rejects.toThrow(DomainError);
  });

  it("từ chối thành viên không thuộc quỹ", async () => {
    const { ports, fundId } = await setup();
    await expect(
      recordIncome(ports, OWNER, fundId, raw("khong-ton-tai"), []),
    ).rejects.toMatchObject({ code: "VALIDATION" });
  });
});

describe("listMembersForIncome — prefill số còn thiếu (AT-09)", () => {
  it("mức 100.000, đã đóng 30.000 → còn thiếu 70.000", async () => {
    const { ports, fundId, memberId } = await setup();
    await recordIncome(ports, OWNER, fundId, raw(memberId, { amount: 30_000 }), []);
    const rows = await listMembersForIncome(ports, fundId);
    const row = rows.find((r) => r.id === memberId)!;
    expect(row.paid).toBe(30_000);
    expect(row.remaining).toBe(70_000);
  });
});
