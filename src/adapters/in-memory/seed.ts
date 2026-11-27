import type { AppPorts } from "@/ports";
import type { UserId } from "@/domain/types";

/** Thủ quỹ demo (giai đoạn đầu chưa có đăng nhập thật — xem T10). */
export const DEMO_OWNER_ID =
  "11111111-1111-4111-8111-111111111111" as UserId;

/**
 * Nạp dữ liệu mẫu cho adapter in-memory: một quỹ + vài thành viên,
 * vài khoản thu (đóng quỹ) và một khoản chi — đủ để dựng UI và thử VietQR.
 */
export async function seedDemo(ports: AppPorts): Promise<void> {
  const fund = await ports.funds.create({
    ownerId: DEMO_OWNER_ID,
    name: "Quỹ lớp 12A1",
    description: "Quỹ chung học kỳ 1 — dữ liệu mẫu để chạy thử.",
    targetPerMember: 100_000,
  });

  // Gắn thông tin nhận tiền để thử sinh VietQR (FR-19).
  await ports.funds.update(fund.id, {
    bankBin: "970436", // Vietcombank (ví dụ)
    bankAccountNumber: "0123456789",
    bankAccountName: "NGUYEN VAN THU QUY",
    transferPrefix: "QUY12A1",
  });

  const members = await ports.members.addMany(fund.id, [
    "Nguyễn An",
    "Trần Bình",
    "Lê Chi",
    "Phạm Dung",
  ]);

  // 3 khoản thu (đóng quỹ) — thu phải có memberId + paymentMethod.
  for (const m of members.slice(0, 3)) {
    await ports.uow.createTransaction(
      {
        fundId: fund.id,
        type: "income",
        amount: 100_000,
        memberId: m.id,
        paymentMethod: "transfer",
        note: `Đóng quỹ: ${m.name}`,
        txnDate: "2026-11-20",
      },
      DEMO_OWNER_ID,
    );
  }

  // 1 khoản chi — chi phải có purpose + category.
  await ports.uow.createTransaction(
    {
      fundId: fund.id,
      type: "expense",
      amount: 150_000,
      purpose: "Mua nước và bánh liên hoan",
      category: "food",
      paymentMethod: "cash",
      note: "Liên hoan cuối kỳ",
      txnDate: "2026-11-25",
    },
    DEMO_OWNER_ID,
  );
}
