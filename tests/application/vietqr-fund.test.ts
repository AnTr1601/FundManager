import { describe, it, expect } from "vitest";
import { createInMemoryPorts } from "@/adapters/in-memory/store";
import {
  createFund,
  createFundSchema,
  updateFundBank,
} from "@/application/funds";
import { buildMemberQRs } from "@/application/transactions";
import type { Clock } from "@/ports";
import type { UserId } from "@/domain/types";

const OWNER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" as UserId;
const fixedClock: Clock = {
  now: () => new Date("2026-11-27T12:00:00+07:00"),
  today: () => "2026-11-27",
};

async function setup() {
  const ports = createInMemoryPorts({ clock: fixedClock });
  const fund = await createFund(
    ports,
    OWNER,
    createFundSchema.parse({ name: "Quỹ", targetPerMember: 100_000 }),
  );
  const [m] = await ports.members.addMany(fund.id, ["An"]);
  return { ports, fundId: fund.id, memberId: m!.id };
}

const bank = {
  bankBin: "970436",
  bankAccountNumber: "0123456789",
  bankAccountName: "NGUYEN VAN A",
  transferPrefix: "QUY12A1",
};

describe("updateFundBank (AT-32)", () => {
  it("lưu thông tin ngân hàng; từ chối BIN sai", async () => {
    const { ports, fundId } = await setup();
    const updated = await updateFundBank(ports, OWNER, fundId, bank);
    expect(updated.bankBin).toBe("970436");
    expect(updated.transferPrefix).toBe("QUY12A1");

    await expect(
      updateFundBank(ports, OWNER, fundId, { ...bank, bankBin: "123" }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
  });
});

describe("buildMemberQRs (AT-34)", () => {
  it("chưa gắn TK → configured=false", async () => {
    const { ports, fundId } = await setup();
    const qr = await buildMemberQRs(ports, fundId);
    expect(qr.configured).toBe(false);
    expect(qr.items).toEqual([]);
  });

  it("mức 100k, đã đóng 30k → QR số tiền 70.000, nội dung 'QUY12A1 AN'", async () => {
    const { ports, fundId, memberId } = await setup();
    await updateFundBank(ports, OWNER, fundId, bank);
    await ports.uow.createTransaction(
      {
        fundId,
        type: "income",
        amount: 30_000,
        memberId,
        paymentMethod: "cash",
        txnDate: "2026-11-20",
      },
      OWNER,
    );

    const qr = await buildMemberQRs(ports, fundId);
    expect(qr.configured).toBe(true);
    const item = qr.items.find((i) => i.id === memberId)!;
    expect(item.amount).toBe(70_000);
    expect(item.content).toBe("QUY12A1 AN");
    expect(item.payload.startsWith("000201")).toBe(true);
    expect(item.payload).toContain("QRIBFTTA");
    expect(item.payload).toContain("540570000"); // tag 54, số tiền 70000
  });
});
