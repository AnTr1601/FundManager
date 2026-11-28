/** Trạng thái form ghi khoản thu, chia sẻ giữa server action và form client. */
export type IncomeState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success" };
