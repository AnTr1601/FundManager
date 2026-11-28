/**
 * Sinh mã VietQR (chuẩn EMVCo / NAPAS 24/7) — hàm thuần, không phụ thuộc hạ tầng.
 * Tiền chạy thẳng vào tài khoản ngân hàng thủ quỹ; app KHÔNG giữ/chuyển tiền (FR-19).
 */
import { DomainError } from "./errors";

/** CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF) → 4 ký tự hex hoa. */
export function crc16ccitt(input: string): string {
  let crc = 0xffff;
  for (let i = 0; i < input.length; i++) {
    crc ^= input.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc & 0x8000) !== 0 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/** Bỏ dấu tiếng Việt (gồm đ/Đ) để nội dung chuyển khoản an toàn cho ngân hàng. */
export function removeVietnameseTones(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // dấu tổ hợp
    .replace(/đ/g, "d") // đ
    .replace(/Đ/g, "D"); // Đ
}

/** Nội dung chuyển khoản: "[TIỀN TỐ] TÊN", bỏ dấu, viết hoa, chỉ A-Z0-9+space, cắt độ dài. */
export function buildTransferContent(
  prefix: string,
  memberName: string,
  maxLen = 25,
): string {
  const raw = `${prefix} ${memberName}`.trim();
  return removeVietnameseTones(raw)
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLen)
    .trim();
}

/** Mã-độ dài-giá trị theo EMVCo (độ dài 2 chữ số). */
function tlv(tag: string, value: string): string {
  return `${tag}${value.length.toString().padStart(2, "0")}${value}`;
}

export interface VietQRInput {
  /** Mã BIN ngân hàng (6 chữ số, NAPAS). */
  bankBin: string;
  /** Số tài khoản thụ hưởng. */
  accountNumber: string;
  /** Số tiền VND (> 0). Bỏ trống → QR tĩnh, người chuyển tự nhập số tiền. */
  amount?: number;
  /** Nội dung chuyển khoản (đã làm sạch bằng buildTransferContent). */
  content?: string;
}

/**
 * Sinh chuỗi payload VietQR hoàn chỉnh (đã gắn CRC) để vẽ QR.
 * Dịch vụ QRIBFTTA = chuyển khoản tới tài khoản.
 */
export function buildVietQR(input: VietQRInput): string {
  if (!/^\d{6}$/.test(input.bankBin)) {
    throw new DomainError("VALIDATION", "Mã BIN ngân hàng phải gồm 6 chữ số.");
  }
  if (!input.accountNumber || !/^\w+$/.test(input.accountNumber)) {
    throw new DomainError("VALIDATION", "Số tài khoản không hợp lệ.");
  }
  const hasAmount = typeof input.amount === "number" && input.amount > 0;

  const beneficiary =
    tlv("00", input.bankBin) + tlv("01", input.accountNumber);
  const merchant =
    tlv("00", "A000000727") + tlv("01", beneficiary) + tlv("02", "QRIBFTTA");

  let s =
    tlv("00", "01") +
    tlv("01", hasAmount ? "12" : "11") +
    tlv("38", merchant) +
    tlv("52", "0000") +
    tlv("53", "704");
  if (hasAmount) s += tlv("54", String(Math.round(input.amount!)));
  s += tlv("58", "VN");
  if (input.content && input.content.length > 0) {
    s += tlv("62", tlv("08", input.content));
  }

  const withCrcTag = `${s}6304`;
  return withCrcTag + crc16ccitt(withCrcTag);
}
