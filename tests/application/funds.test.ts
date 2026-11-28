import { describe, it, expect, beforeEach } from "vitest";
import { createInMemoryPorts } from "@/adapters/in-memory/store";
import {
  createFund,
  createFundSchema,
  listMyFundsWithBalance,
} from "@/application/funds";
import type { AppPorts } from "@/ports";
import type { UserId } from "@/domain/types";

const OWNER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" as UserId;
const OTHER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" as UserId;

describe("createFundSchema (AT-03)", () => {
  it("từ chối tên trống", () => {
    expect(createFundSchema.safeParse({ name: "" }).success).toBe(false);
    expect(createFundSchema.safeParse({ name: "   " }).success).toBe(false);
  });

  it("từ chối tên > 100 ký tự và mô tả > 500 ký tự", () => {
    expect(createFundSchema.safeParse({ name: "a".repeat(101) }).success).toBe(
      false,
    );
    expect(
      createFundSchema.safeParse({ name: "Quỹ", description: "x".repeat(501) })
        .success,
    ).toBe(false);
  });

  it("từ chối mức đóng âm", () => {
    expect(
      createFundSchema.safeParse({ name: "Quỹ", targetPerMember: -1 }).success,
    ).toBe(false);
  });

  it("mặc định mức đóng = 0 khi để trống; trim tên", () => {
    const r = createFundSchema.safeParse({ name: "  Quỹ 12A1  " });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.name).toBe("Quỹ 12A1");
      expect(r.data.targetPerMember).toBe(0);
    }
  });
});

describe("createFund + listMyFundsWithBalance (AT-04)", () => {
  let ports: AppPorts;
  beforeEach(() => {
    ports = createInMemoryPorts();
  });

  it("tạo quỹ: có token, publicEnabled false, số dư 0", async () => {
    const fields = createFundSchema.parse({
      name: "Quỹ 12A1",
      targetPerMember: 100_000,
    });
    const fund = await createFund(ports, OWNER, fields);

    expect(fund.ownerId).toBe(OWNER);
    expect(fund.name).toBe("Quỹ 12A1");
    expect(fund.targetPerMember).toBe(100_000);
    expect(fund.memberToken).toBeTruthy();
    expect(fund.publicToken).toBeTruthy();
    expect(fund.publicEnabled).toBe(false);

    const list = await listMyFundsWithBalance(ports, OWNER);
    expect(list).toHaveLength(1);
    expect(list[0]!.totals.balance).toBe(0);
  });

  it("chỉ liệt kê quỹ của đúng chủ sở hữu", async () => {
    await createFund(ports, OWNER, createFundSchema.parse({ name: "Của tôi" }));
    await createFund(
      ports,
      OTHER,
      createFundSchema.parse({ name: "Của người khác" }),
    );

    const list = await listMyFundsWithBalance(ports, OWNER);
    expect(list).toHaveLength(1);
    expect(list[0]!.fund.name).toBe("Của tôi");
  });
});
