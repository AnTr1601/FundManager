import { describe, it, expect } from "vitest";
import { assertValidAmount, addVnd, subVnd, MAX_AMOUNT } from "@/domain/money";
import { DomainError } from "@/domain/errors";

describe("assertValidAmount (BR-01)", () => {
  it("chấp nhận số nguyên dương trong giới hạn", () => {
    expect(() => assertValidAmount(1)).not.toThrow();
    expect(() => assertValidAmount(100_000)).not.toThrow();
    expect(() => assertValidAmount(MAX_AMOUNT)).not.toThrow();
  });

  it("từ chối 0 và số âm", () => {
    expect(() => assertValidAmount(0)).toThrow(DomainError);
    expect(() => assertValidAmount(-5000)).toThrow(DomainError);
  });

  it("từ chối số không nguyên", () => {
    expect(() => assertValidAmount(1000.5)).toThrow(DomainError);
  });

  it("từ chối vượt giới hạn 1 tỷ", () => {
    expect(() => assertValidAmount(MAX_AMOUNT + 1)).toThrow(DomainError);
  });

  it("ném DomainError mã VALIDATION", () => {
    expect.assertions(1);
    try {
      assertValidAmount(0);
    } catch (e) {
      expect((e as DomainError).code).toBe("VALIDATION");
    }
  });
});

describe("addVnd / subVnd", () => {
  it("cộng và trừ đúng", () => {
    expect(addVnd(100_000, 50_000)).toBe(150_000);
    expect(subVnd(100_000, 30_000)).toBe(70_000);
  });
});
