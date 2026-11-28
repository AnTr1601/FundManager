import { z } from "zod";
import type { AppPorts, NewFund } from "@/ports";
import type { Fund, UserId } from "@/domain/types";
import { computeTotals, type FundTotals } from "@/domain/balance";

/** Kiểm tra dữ liệu tạo quỹ ở biên ứng dụng (FR-03; AT-03). */
export const createFundSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Tên quỹ không được để trống.")
    .max(100, "Tên quỹ tối đa 100 ký tự."),
  description: z
    .string()
    .trim()
    .max(500, "Mô tả tối đa 500 ký tự.")
    .optional(),
  targetPerMember: z.coerce
    .number()
    .int("Mức đóng phải là số nguyên.")
    .min(0, "Mức đóng không được âm.")
    .max(1_000_000_000, "Mức đóng quá lớn.")
    .default(0),
});

export type CreateFundFields = z.infer<typeof createFundSchema>;

/** Tạo quỹ cho thủ quỹ hiện tại; token member/public do adapter tự sinh. */
export async function createFund(
  ports: AppPorts,
  ownerId: UserId,
  fields: CreateFundFields,
): Promise<Fund> {
  const input: NewFund = {
    ownerId,
    name: fields.name,
    description:
      fields.description && fields.description.length > 0
        ? fields.description
        : null,
    targetPerMember: fields.targetPerMember,
  };
  return ports.funds.create(input);
}

export interface FundWithBalance {
  fund: Fund;
  totals: FundTotals;
}

/** Danh sách quỹ của thủ quỹ kèm số dư (tính từ giao dịch, BR-02). */
export async function listMyFundsWithBalance(
  ports: AppPorts,
  ownerId: UserId,
): Promise<FundWithBalance[]> {
  const funds = await ports.funds.listByOwner(ownerId);
  return Promise.all(
    funds.map(async (fund) => {
      // Quỹ mới chưa có giao dịch ⇒ số dư 0 (AT-04).
      const page = await ports.transactions.listByFund(fund.id, {
        pageSize: 1000,
      });
      return { fund, totals: computeTotals(page.data) };
    }),
  );
}
