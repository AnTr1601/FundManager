import type { UserId } from "@/domain/types";

/** Đồng hồ hệ thống (tiêm được để test tất định). */
export interface Clock {
  now(): Date;
  /** Ngày hôm nay 'YYYY-MM-DD' theo giờ Việt Nam. */
  today(): string;
}

export interface IdGenerator {
  uuid(): string;
}

/** Sinh token ngẫu nhiên an toàn mật mã ≥128-bit (FR-14.1, NFR-S3). */
export interface TokenGenerator {
  secureToken(): string;
}

export interface AuthUser {
  id: UserId;
  email: string;
}

/** Danh tính thủ quỹ hiện tại (giai đoạn đầu: giả lập dev; sau: Google OAuth). */
export interface AuthPort {
  getCurrentUser(): Promise<AuthUser | null>;
}
