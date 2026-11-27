/**
 * Lỗi miền với mã máy-đọc-được. Tầng ứng dụng ánh xạ `code` sang HTTP status;
 * giao diện hiển thị `message` (tiếng Việt) cho người dùng (NFR-U8).
 */
export type ErrorCode =
  | "VALIDATION" // 422: dữ liệu sai định dạng / ràng buộc
  | "NOT_FOUND" // 404
  | "FORBIDDEN" // 403: không đủ quyền
  | "LINK_REVOKED" // token sai / đã thu hồi / đang tắt (FR-14.5)
  | "CONFLICT" // 409: trùng, xung đột
  | "RULE_VIOLATION"; // vi phạm quy tắc nghiệp vụ (xóa giao dịch, sửa nhật ký...)

export class DomainError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "DomainError";
  }
}
