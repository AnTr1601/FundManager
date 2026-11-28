"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getPorts } from "@/lib/container";
import { getCurrentUser } from "@/lib/auth/session";
import { createFund, createFundSchema } from "@/application/funds";
import type { CreateFundState } from "./fund-form-state";

export async function createFundAction(
  _prevState: CreateFundState,
  formData: FormData,
): Promise<CreateFundState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const raw = {
    name: String(formData.get("name") ?? ""),
    description: String(formData.get("description") ?? ""),
    targetPerMember: formData.get("targetPerMember")
      ? String(formData.get("targetPerMember"))
      : undefined,
  };

  const parsed = createFundSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "");
      if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { status: "error", fieldErrors };
  }

  await createFund(getPorts(), user.id, parsed.data);
  revalidatePath("/funds");
  return { status: "success" };
}
