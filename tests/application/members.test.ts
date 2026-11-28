import { describe, it, expect, beforeEach } from "vitest";
import { createInMemoryPorts } from "@/adapters/in-memory/store";
import { createFund, createFundSchema } from "@/application/funds";
import {
  parseNames,
  planMemberAddition,
  addMembers,
  renameMember,
  setMemberActive,
  removeMember,
} from "@/application/members";
import { DomainError } from "@/domain/errors";
import type { AppPorts } from "@/ports";
import type { FundId, UserId } from "@/domain/types";

const OWNER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" as UserId;

async function newFund(ports: AppPorts): Promise<FundId> {
  const f = await createFund(ports, OWNER, createFundSchema.parse({ name: "Quỹ" }));
  return f.id;
}

describe("parseNames", () => {
  it("bỏ dòng trống và khoảng trắng thừa", () => {
    expect(parseNames("  An \n\n Bình \n   \nChi\n")).toEqual([
      "An",
      "Bình",
      "Chi",
    ]);
  });
});

describe("planMemberAddition", () => {
  it("loại trùng (có sẵn + trùng trong danh sách) khi không cho phép trùng", () => {
    const plan = planMemberAddition(["An"], ["Bình", "an", "Bình", "Chi"], false);
    expect(plan.toAdd).toEqual(["Bình", "Chi"]);
    expect(plan.duplicates).toEqual(["an", "Bình"]);
  });

  it("giữ tất cả khi allowDuplicates", () => {
    const plan = planMemberAddition(["An"], ["An", "An"], true);
    expect(plan.toAdd).toEqual(["An", "An"]);
    expect(plan.duplicates).toEqual([]);
  });
});

describe("addMembers (AT-05)", () => {
  let ports: AppPorts;
  let fundId: FundId;
  beforeEach(async () => {
    ports = createInMemoryPorts();
    fundId = await newFund(ports);
  });

  it("dán 40 tên (2 dòng trống + 1 trùng) → thêm 39, cảnh báo 1", async () => {
    const names = Array.from({ length: 39 }, (_, i) => `TV ${i + 1}`);
    const raw = [...names.slice(0, 20), "", "  ", "TV 1", ...names.slice(20)].join(
      "\n",
    );
    const res = await addMembers(ports, fundId, raw, false);
    expect(res.addedCount).toBe(39);
    expect(res.duplicates).toEqual(["TV 1"]);

    const stored = await ports.members.listByFund(fundId);
    expect(stored).toHaveLength(39);
  });
});

describe("sửa tên / ngưng / xóa thành viên (AT-06)", () => {
  let ports: AppPorts;
  let fundId: FundId;
  beforeEach(async () => {
    ports = createInMemoryPorts();
    fundId = await newFund(ports);
  });

  it("đổi tên hợp lệ; từ chối tên trống", async () => {
    const [m] = await ports.members.addMany(fundId, ["Cũ"]);
    const updated = await renameMember(ports, fundId, m!.id, "  Mới  ");
    expect(updated.name).toBe("Mới");
    await expect(renameMember(ports, fundId, m!.id, "   ")).rejects.toThrow(
      DomainError,
    );
  });

  it("ngưng tham gia đổi isActive=false", async () => {
    const [m] = await ports.members.addMany(fundId, ["An"]);
    const off = await setMemberActive(ports, fundId, m!.id, false);
    expect(off.isActive).toBe(false);
  });

  it("xóa được khi chưa có giao dịch; bị chặn khi đã có", async () => {
    const [m] = await ports.members.addMany(fundId, ["An"]);
    await removeMember(ports, fundId, m!.id);
    expect(await ports.members.getById(m!.id)).toBeNull();

    const [m2] = await ports.members.addMany(fundId, ["Bình"]);
    await ports.uow.createTransaction(
      {
        fundId,
        type: "income",
        amount: 50_000,
        memberId: m2!.id,
        paymentMethod: "cash",
        txnDate: "2026-11-20",
      },
      OWNER,
    );
    await expect(removeMember(ports, fundId, m2!.id)).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });
});
