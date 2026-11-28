import type { AuthUser } from "@/ports";
import type { UserId } from "@/domain/types";
import { DEMO_OWNER_ID } from "@/adapters/in-memory/seed";

/**
 * Tên cookie phiên. Giai đoạn dev: cookie chỉ chứa id của user giả lập
 * (chưa ký/mã hóa — sẽ thay bằng phiên Google OAuth thật ở T27+).
 */
export const SESSION_COOKIE = "fm_session";

/**
 * Danh sách thủ quỹ GIẢ LẬP cho giai đoạn đầu (không mật khẩu) — chỉ để dựng
 * và thử UI. User đầu tiên trùng chủ quỹ của seed demo nên đăng nhập bằng nó
 * sẽ thấy ngay "Quỹ lớp 12A1". Pure + không phụ thuộc Next → middleware dùng được.
 */
export const DEV_USERS: readonly AuthUser[] = [
  { id: DEMO_OWNER_ID, email: "thuquy.demo@lop12a1.vn" },
  {
    id: "22222222-2222-4222-8222-222222222222" as UserId,
    email: "an.nguyen@example.com",
  },
  {
    id: "33333333-3333-4333-8333-333333333333" as UserId,
    email: "binh.tran@example.com",
  },
];

/** Tìm user dev theo id (dùng để kiểm tra giá trị cookie). */
export function findDevUser(id: string | undefined | null): AuthUser | null {
  if (!id) return null;
  return DEV_USERS.find((u) => u.id === id) ?? null;
}
