/** Trạng thái form ghi khoản chi, chia sẻ giữa server action và form client. */
export type ExpenseState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success" };
