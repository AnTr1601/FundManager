import { describe, it, expect } from "vitest";
import {
  computeMemberPaid,
  computeMemberStatus,
} from "@/domain/payment-status";
import type { MemberId } from "@/domain/types";
import { makeTxn, makeExpense } from "../support/factories";

const A = "mem-A" as MemberId;
const B = "mem-B" as MemberId;

describe("computeMemberPaid (FR-12.1)", () => {
  it("tổng khoản thu active của một thành viên", () => {
    const txns = [
      makeTxn({ memberId: A, amount: 60_000 }),
      makeTxn({ memberId: A, amount: 40_000 }),
      makeTxn({ memberId: B, amount: 100_000 }),
      makeTxn({ memberId: A, amount: 999, status: "voided", voidReason: "nhầm" }),
      makeExpense({ amount: 500_000 }), // chi không tính vào "đã đóng"
    ];
    expect(computeMemberPaid(A, txns)).toBe(100_000);
    expect(computeMemberPaid(B, txns)).toBe(100_000);
  });
});

describe("computeMemberStatus (FR-12.2, FR-12.3, AT-23)", () => {
  it("mức đóng 100.000: đủ→paid, thiếu→partial, chưa→unpaid", () => {
    expect(computeMemberStatus(100_000, 100_000)).toBe("paid");
    expect(computeMemberStatus(120_000, 100_000)).toBe("paid");
    expect(computeMemberStatus(50_000, 100_000)).toBe("partial");
    expect(computeMemberStatus(0, 100_000)).toBe("unpaid");
  });

  it("quỹ không đặt mức đóng (target=0) → null (không hiện trạng thái)", () => {
    expect(computeMemberStatus(0, 0)).toBeNull();
    expect(computeMemberStatus(50_000, 0)).toBeNull();
  });
});
