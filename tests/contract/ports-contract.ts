import { describe, it, expect, beforeEach } from "vitest";
import type { AppPorts } from "@/ports";
import type { UserId } from "@/domain/types";

const ACTOR = "00000000-0000-4000-8000-000000000001" as UserId;

/** Dựng nhanh một quỹ + một thành viên để dùng trong các kịch bản. */
async function makeFundWithMember(ports: AppPorts) {
  const fund = await ports.funds.create({ ownerId: ACTOR, name: "Quỹ test" });
  const [member] = await ports.members.addMany(fund.id, ["Thành viên A"]);
  return { fund, member: member! };
}

/**
 * Bộ "hợp đồng" cho AppPorts: mô tả các bất biến minh bạch mà MỌI adapter
 * phải thỏa (in-memory lẫn Supabase sau này). Gọi với một factory tạo adapter sạch.
 */
export function runPortsContract(
  label: string,
  makePorts: () => AppPorts | Promise<AppPorts>,
) {
  describe(`Hợp đồng AppPorts — ${label}`, () => {
    let ports: AppPorts;
    beforeEach(async () => {
      ports = await makePorts();
    });

    // --- BR-03 / AT-21: không có đường xóa giao dịch ---
    it("không hề lộ đường xóa giao dịch (BR-03)", () => {
      const txns = ports.transactions as unknown as Record<string, unknown>;
      expect(typeof txns.delete).not.toBe("function");
      expect(typeof txns.remove).not.toBe("function");
      const uow = ports.uow as unknown as Record<string, unknown>;
      expect(typeof uow.deleteTransaction).not.toBe("function");
    });

    // --- Nhật ký chỉ-thêm: create→update→void sinh đúng 3 bản ghi ---
    it("create→update→void sinh đúng 3 log create/update/void (chỉ-thêm)", async () => {
      const { fund, member } = await makeFundWithMember(ports);

      const txn = await ports.uow.createTransaction(
        {
          fundId: fund.id,
          type: "income",
          amount: 100_000,
          memberId: member.id,
          paymentMethod: "transfer",
          txnDate: "2026-11-20",
        },
        ACTOR,
      );

      await ports.uow.updateTransaction(
        txn.id,
        { amount: 120_000, note: "Sửa số tiền" },
        ACTOR,
      );
      await ports.uow.voidTransaction(txn.id, "Ghi nhầm, hủy lại", ACTOR);

      const log = await ports.auditLogs.listByFund(fund.id, {
        page: 1,
        pageSize: 50,
      });
      expect(log.totalItems).toBe(3);

      // Sắp theo thứ tự thời gian (adapter có thể trả mới-nhất-trước).
      const chrono = [...log.data].sort((a, b) => a.id - b.id);
      expect(chrono.map((e) => e.action)).toEqual(["create", "update", "void"]);

      // create: oldData null; update/void: có oldData (bản trước).
      expect(chrono[0]!.oldData).toBeNull();
      expect(chrono[1]!.oldData).not.toBeNull();
      expect(chrono[2]!.oldData).not.toBeNull();
      // Mọi bản ghi đều giữ newData (ảnh chụp sau thay đổi).
      expect(chrono.every((e) => e.newData != null)).toBe(true);
    });

    // --- FR-14.4 / AT-27: rotate token làm token cũ vô hiệu ---
    it("rotate memberToken làm link cũ vô hiệu, link mới hiệu lực", async () => {
      const { fund } = await makeFundWithMember(ports);
      const oldToken = fund.memberToken;

      expect((await ports.funds.getByMemberToken(oldToken))?.id).toBe(fund.id);

      const rotated = await ports.funds.rotateToken(fund.id, "member");
      expect(rotated.memberToken).not.toBe(oldToken);

      expect(await ports.funds.getByMemberToken(oldToken)).toBeNull();
      expect(
        (await ports.funds.getByMemberToken(rotated.memberToken))?.id,
      ).toBe(fund.id);
    });

    // --- FR-14.6 / AT-28: public token tắt thì KHÔNG trả dữ liệu ---
    it("publicEnabled=false thì getByPublicToken không trả dữ liệu dù đúng token", async () => {
      const { fund } = await makeFundWithMember(ports);
      // Mặc định publicEnabled = false.
      expect(await ports.funds.getByPublicToken(fund.publicToken)).toBeNull();

      const on = await ports.funds.update(fund.id, { publicEnabled: true });
      expect((await ports.funds.getByPublicToken(on.publicToken))?.id).toBe(
        fund.id,
      );
    });

    it("rotate publicToken làm link công khai cũ vô hiệu", async () => {
      const { fund } = await makeFundWithMember(ports);
      const on = await ports.funds.update(fund.id, { publicEnabled: true });
      const oldToken = on.publicToken;
      expect((await ports.funds.getByPublicToken(oldToken))?.id).toBe(fund.id);

      const rotated = await ports.funds.rotateToken(fund.id, "public");
      expect(rotated.publicToken).not.toBe(oldToken);
      expect(await ports.funds.getByPublicToken(oldToken)).toBeNull();
      expect(
        (await ports.funds.getByPublicToken(rotated.publicToken))?.id,
      ).toBe(fund.id);
    });
  });
}
