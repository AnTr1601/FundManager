import "server-only";
import { cookies } from "next/headers";
import type { AuthUser } from "@/ports";
import { SESSION_COOKIE, findDevUser } from "./constants";

/**
 * Hiện thực AuthPort ở lớp Next: danh tính thủ quỹ hiện tại lấy từ cookie phiên.
 * (getCurrentUser cần ngữ cảnh request/cookie nên đặt ở đây, không ở adapter thuần.)
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const store = await cookies();
  return findDevUser(store.get(SESSION_COOKIE)?.value);
}

/** Đặt cookie phiên cho user dev (gọi trong Server Action của trang /login). */
export async function setSession(userId: string): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, userId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 7, // 7 ngày
  });
}

/** Xóa cookie phiên (đăng xuất). */
export async function clearSession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}
