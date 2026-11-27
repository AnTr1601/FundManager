import type { FundId } from "@/domain/types";

/** Lưu trữ ảnh chứng từ trong kho riêng tư (NFR-S4). */
export interface StoragePort {
  /** Lưu ảnh đã nén, trả về đường dẫn trong kho (không phải URL công khai). */
  put(
    fundId: FundId,
    bytes: Blob,
    contentType: string,
  ): Promise<{ storagePath: string; sizeBytes: number }>;
  /** Trả về signed URL hết hạn ≤ 1 giờ (in-memory: object URL tạm). */
  signedUrl(storagePath: string, ttlSeconds?: number): Promise<string>;
}
