"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getPorts } from "@/lib/container";
import { getCurrentUser } from "@/lib/auth/session";
import { requireOwnedFund } from "@/application/guard";
import {
  addMembers,
  renameMember,
  setMemberActive,
  removeMember,
} from "@/application/members";
import {
  recordIncome,
  recordExpense,
  expenseSchema,
  type AttachmentInput,
} from "@/application/transactions";
import { DomainError } from "@/domain/errors";
import type { AppPorts } from "@/ports";
import type { FundId, MemberId } from "@/domain/types";
import type { IncomeState } from "./income-state";
import type { ExpenseState } from "./expense-state";

/** Xác thực đăng nhập + quyền chủ quỹ; trả ports đã sẵn. */
async function authorize(fundId: string): Promise<AppPorts> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const ports = getPorts();
  await requireOwnedFund(ports, user.id, fundId as FundId);
  return ports;
}

function messageOf(e: unknown): string {
  if (e instanceof DomainError) return e.message;
  throw e; // lỗi bất ngờ: để Next xử lý
}

export async function addMembersAction(formData: FormData): Promise<void> {
  const fundId = String(formData.get("fundId") ?? "");
  const ports = await authorize(fundId);
  const raw = String(formData.get("names") ?? "");
  const allowDuplicates = formData.get("allowDuplicates") === "on";

  const { addedCount, duplicates } = await addMembers(
    ports,
    fundId as FundId,
    raw,
    allowDuplicates,
  );
  revalidatePath(`/funds/${fundId}`);
  redirect(
    `/funds/${fundId}?added=${addedCount}&skipped=${duplicates.length}`,
  );
}

export async function renameMemberAction(formData: FormData): Promise<void> {
  const fundId = String(formData.get("fundId") ?? "");
  const ports = await authorize(fundId);
  const memberId = String(formData.get("memberId") ?? "") as MemberId;
  const name = String(formData.get("name") ?? "");

  let error: string | null = null;
  try {
    await renameMember(ports, fundId as FundId, memberId, name);
  } catch (e) {
    error = messageOf(e);
  }
  if (error) redirect(`/funds/${fundId}?err=${encodeURIComponent(error)}`);
  revalidatePath(`/funds/${fundId}`);
  redirect(`/funds/${fundId}`);
}

export async function recordIncomeAction(
  _prev: IncomeState,
  formData: FormData,
): Promise<IncomeState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const fundId = String(formData.get("fundId") ?? "");
  const ports = getPorts();

  // Kiểm quyền chủ quỹ trước khi lưu ảnh.
  try {
    await requireOwnedFund(ports, user.id, fundId as FundId);
  } catch (e) {
    return { status: "error", message: messageOf(e) };
  }

  const attachments: AttachmentInput[] = [];
  const file = formData.get("receipt");
  if (file instanceof File && file.size > 0) {
    const saved = await ports.storage.put(fundId as FundId, file, file.type);
    attachments.push({
      storagePath: saved.storagePath,
      sizeBytes: saved.sizeBytes,
    });
  }

  const raw = {
    memberId: String(formData.get("memberId") ?? ""),
    amount: String(formData.get("amount") ?? ""),
    paymentMethod: String(formData.get("paymentMethod") ?? ""),
    txnDate: String(formData.get("txnDate") ?? ""),
    note: formData.get("note") ? String(formData.get("note")) : undefined,
  };

  try {
    await recordIncome(ports, user.id, fundId as FundId, raw, attachments);
  } catch (e) {
    return { status: "error", message: messageOf(e) };
  }
  revalidatePath(`/funds/${fundId}`);
  return { status: "success" };
}

export async function recordExpenseAction(
  _prev: ExpenseState,
  formData: FormData,
): Promise<ExpenseState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const fundId = String(formData.get("fundId") ?? "");
  const ports = getPorts();

  try {
    await requireOwnedFund(ports, user.id, fundId as FundId);
  } catch (e) {
    return { status: "error", message: messageOf(e) };
  }

  const noReceipt = formData.get("noReceipt") === "on";
  const raw = {
    amount: String(formData.get("amount") ?? ""),
    purpose: String(formData.get("purpose") ?? ""),
    category: String(formData.get("category") ?? ""),
    paymentMethod: formData.get("paymentMethod")
      ? String(formData.get("paymentMethod"))
      : undefined,
    txnDate: String(formData.get("txnDate") ?? ""),
    note: formData.get("note") ? String(formData.get("note")) : undefined,
    noReceipt,
    noReceiptReason: formData.get("noReceiptReason")
      ? String(formData.get("noReceiptReason"))
      : undefined,
  };
  const allowOverspend = formData.get("confirmOverspend") === "on";

  // Chặn tải ảnh khi dữ liệu đã sai từ đầu.
  const pre = expenseSchema.safeParse(raw);
  if (!pre.success) {
    return {
      status: "error",
      message: pre.error.issues[0]?.message ?? "Dữ liệu không hợp lệ.",
    };
  }

  const attachments: AttachmentInput[] = [];
  const file = formData.get("receipt");
  if (file instanceof File && file.size > 0) {
    const saved = await ports.storage.put(fundId as FundId, file, file.type);
    attachments.push({
      storagePath: saved.storagePath,
      sizeBytes: saved.sizeBytes,
    });
  }

  try {
    await recordExpense(
      ports,
      user.id,
      fundId as FundId,
      raw,
      attachments,
      allowOverspend,
    );
  } catch (e) {
    return { status: "error", message: messageOf(e) };
  }
  revalidatePath(`/funds/${fundId}`);
  return { status: "success" };
}

export async function setMemberActiveAction(formData: FormData): Promise<void> {
  const fundId = String(formData.get("fundId") ?? "");
  const ports = await authorize(fundId);
  const memberId = String(formData.get("memberId") ?? "") as MemberId;
  const isActive = formData.get("active") === "true";

  await setMemberActive(ports, fundId as FundId, memberId, isActive);
  revalidatePath(`/funds/${fundId}`);
  redirect(`/funds/${fundId}`);
}

export async function removeMemberAction(formData: FormData): Promise<void> {
  const fundId = String(formData.get("fundId") ?? "");
  const ports = await authorize(fundId);
  const memberId = String(formData.get("memberId") ?? "") as MemberId;

  let error: string | null = null;
  try {
    await removeMember(ports, fundId as FundId, memberId);
  } catch (e) {
    error = messageOf(e);
  }
  if (error) redirect(`/funds/${fundId}?err=${encodeURIComponent(error)}`);
  revalidatePath(`/funds/${fundId}`);
  redirect(`/funds/${fundId}`);
}
