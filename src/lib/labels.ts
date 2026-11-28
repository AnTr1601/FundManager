import type { ExpenseCategory, PaymentMethod } from "@/domain/types";

/** Danh mục chi + nhãn tiếng Việt (FR-06), theo thứ tự hiển thị. */
export const EXPENSE_CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: "food", label: "Ăn uống" },
  { value: "printing", label: "In ấn, văn phòng phẩm" },
  { value: "gift", label: "Quà tặng" },
  { value: "transport", label: "Di chuyển" },
  { value: "charity", label: "Thiện nguyện" },
  { value: "other", label: "Khác" },
];

const CATEGORY_LABEL = new Map(
  EXPENSE_CATEGORIES.map((c) => [c.value, c.label]),
);

export function categoryLabel(c: ExpenseCategory | null): string {
  return c ? (CATEGORY_LABEL.get(c) ?? c) : "";
}

export function methodLabel(m: PaymentMethod | null): string {
  if (m === "transfer") return "Chuyển khoản";
  if (m === "cash") return "Tiền mặt";
  return "";
}
