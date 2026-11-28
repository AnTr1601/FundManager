import { describe, it, expect } from "vitest";
import {
  crc16ccitt,
  removeVietnameseTones,
  buildTransferContent,
  buildVietQR,
} from "@/domain/vietqr";
import { DomainError } from "@/domain/errors";

describe("crc16ccitt (CRC-16/CCITT-FALSE)", () => {
  it('vector chuẩn "123456789" → 29B1', () => {
    expect(crc16ccitt("123456789")).toBe("29B1");
  });
  it("luôn trả 4 ký tự hex hoa", () => {
    expect(crc16ccitt("A")).toMatch(/^[0-9A-F]{4}$/);
  });
});

describe("removeVietnameseTones / buildTransferContent", () => {
  it("bỏ dấu, xử lý đ/Đ", () => {
    expect(removeVietnameseTones("Nguyễn Đức Mạnh")).toBe("Nguyen Duc Manh");
  });
  it("ghép tiền tố + tên, viết hoa, bỏ ký tự lạ, gộp khoảng trắng", () => {
    expect(buildTransferContent("QUY12A1", "Lê  Chi!")).toBe("QUY12A1 LE CHI");
  });
  it("cắt theo độ dài tối đa", () => {
    const s = buildTransferContent("QUY12A1", "Nguyễn Thị Hoàng Anh", 12);
    expect(s.length).toBeLessThanOrEqual(12);
    expect(s).toBe("QUY12A1 NGUY");
  });
});

describe("buildVietQR — chuỗi EMVCo/Napas (AT-33)", () => {
  it("vector mẫu: BIN + số TK + số tiền + nội dung → chuỗi + CRC đúng", () => {
    const input = {
      bankBin: "970436",
      accountNumber: "0123456789",
      amount: 70000,
      content: "QUY12A1 AN",
    };

    const merchant =
      "0010A000000727" +
      "0124000697043601100123456789" +
      "0208QRIBFTTA";
    const base =
      "000201" +
      "010212" +
      "3854" +
      merchant +
      "52040000" +
      "5303704" +
      "540570000" +
      "5802VN" +
      "62140810QUY12A1 AN" +
      "6304";
    const expected = base + crc16ccitt(base);

    expect(buildVietQR(input)).toBe(expected);
  });

  it("không có số tiền → POI tĩnh 11, currency liền ngay country (không tag 54)", () => {
    const s = buildVietQR({ bankBin: "970436", accountNumber: "0123456789" });
    expect(s.startsWith("000201010211")).toBe(true);
    // Không có tag 54 ⇒ 53 (currency) nối thẳng 58 (country).
    expect(s).toContain("53037045802VN");
  });

  it("CRC tự nhất quán (4 ký tự cuối = CRC của phần đầu)", () => {
    const s = buildVietQR({
      bankBin: "970422",
      accountNumber: "0011012345678",
      amount: 50000,
      content: "QUY CHUYEN TIEN",
    });
    const body = s.slice(0, -4);
    expect(s.slice(-4)).toBe(crc16ccitt(body));
  });

  it("từ chối BIN không đủ 6 chữ số hoặc số TK rỗng", () => {
    expect(() =>
      buildVietQR({ bankBin: "97043", accountNumber: "0123456789" }),
    ).toThrow(DomainError);
    expect(() =>
      buildVietQR({ bankBin: "970436", accountNumber: "" }),
    ).toThrow(DomainError);
  });
});
