/** Trạng thái form tạo quỹ, chia sẻ giữa server action và form client. */
export type CreateFundState =
  | { status: "idle" }
  | { status: "error"; fieldErrors: Record<string, string> }
  | { status: "success" };
