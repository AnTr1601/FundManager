import { describe, it, expect } from "vitest";
import { DEV_USERS, SESSION_COOKIE, findDevUser } from "@/lib/auth/constants";
import { DEMO_OWNER_ID } from "@/adapters/in-memory/seed";

describe("Đăng nhập giả lập (dev)", () => {
  it("có hằng tên cookie phiên", () => {
    expect(SESSION_COOKIE).toBeTruthy();
  });

  it("chủ quỹ của seed demo nằm trong danh sách dev user", () => {
    expect(DEV_USERS.some((u) => u.id === DEMO_OWNER_ID)).toBe(true);
  });

  it("findDevUser: trả user hợp lệ; null với id lạ/rỗng/null", () => {
    expect(findDevUser(DEMO_OWNER_ID)?.id).toBe(DEMO_OWNER_ID);
    expect(findDevUser("khong-ton-tai")).toBeNull();
    expect(findDevUser("")).toBeNull();
    expect(findDevUser(undefined)).toBeNull();
    expect(findDevUser(null)).toBeNull();
  });

  it("mọi dev user có id duy nhất và email hợp lệ", () => {
    const ids = DEV_USERS.map((u) => u.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(DEV_USERS.every((u) => u.email.includes("@"))).toBe(true);
  });
});
