import { describe, it, expect } from "vitest";
import { formatMoney, formatDate } from "@/lib/format";

describe("formatMoney (NFR-U5)", () => {
  it("định dạng tiền VN có phân cách nghìn + đơn vị đ", () => {
    expect(formatMoney(1_250_000)).toBe("1.250.000 đ");
    expect(formatMoney(100_000)).toBe("100.000 đ");
    expect(formatMoney(0)).toBe("0 đ");
  });

  it("số âm (thủ quỹ ứng trước)", () => {
    expect(formatMoney(-30_000)).toBe("-30.000 đ");
  });
});

describe("formatDate (NFR-U5)", () => {
  it("định dạng DD/MM/YYYY từ chuỗi YYYY-MM-DD", () => {
    expect(formatDate("2026-11-21")).toBe("21/11/2026");
    expect(formatDate("2026-01-05")).toBe("05/01/2026");
  });

  it("định dạng từ đối tượng Date", () => {
    expect(formatDate(new Date(2026, 10, 21))).toBe("21/11/2026");
  });
});
