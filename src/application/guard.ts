import type { AppPorts } from "@/ports";
import type { Fund, FundId, UserId } from "@/domain/types";
import { DomainError } from "@/domain/errors";

/**
 * Chỉ chủ quỹ mới thao tác được quỹ của mình (FR-02). Ném NOT_FOUND nếu quỹ
 * không tồn tại, FORBIDDEN nếu không phải chủ. Dùng ở mọi use-case của thủ quỹ.
 */
export async function requireOwnedFund(
  ports: AppPorts,
  ownerId: UserId,
  fundId: FundId,
): Promise<Fund> {
  const fund = await ports.funds.getById(fundId);
  if (!fund) throw new DomainError("NOT_FOUND", "Không tìm thấy quỹ.");
  if (fund.ownerId !== ownerId) {
    throw new DomainError("FORBIDDEN", "Bạn không có quyền với quỹ này.");
  }
  return fund;
}
