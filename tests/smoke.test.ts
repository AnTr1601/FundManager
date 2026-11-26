import { describe, it, expect } from "vitest";

// Test khói: xác nhận Vitest chạy. Sẽ được thay bằng test miền thật ở T3+.
describe("vitest setup", () => {
  it("chạy được", () => {
    expect(1 + 1).toBe(2);
  });
});
