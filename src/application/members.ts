import { z } from "zod";
import type { AppPorts } from "@/ports";
import type { FundId, MemberId, Member } from "@/domain/types";
import { DomainError } from "@/domain/errors";

export const memberNameSchema = z
  .string()
  .trim()
  .min(1, "Tên thành viên không được để trống.")
  .max(100, "Tên thành viên tối đa 100 ký tự.");

/** Tách danh sách tên dán vào: mỗi dòng một tên, bỏ dòng trống/khoảng trắng (FR-04.2). */
export function parseNames(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function norm(name: string): string {
  return name.trim().toLowerCase();
}

export interface AdditionPlan {
  toAdd: string[];
  duplicates: string[];
}

/**
 * Lập kế hoạch thêm: loại tên trùng (so với thành viên hiện có và trùng trong
 * chính danh sách dán) trừ khi allowDuplicates. Giữ nguyên thứ tự xuất hiện.
 */
export function planMemberAddition(
  existingNames: string[],
  pasted: string[],
  allowDuplicates: boolean,
): AdditionPlan {
  if (allowDuplicates) return { toAdd: [...pasted], duplicates: [] };
  const seen = new Set(existingNames.map(norm));
  const toAdd: string[] = [];
  const duplicates: string[] = [];
  for (const name of pasted) {
    const key = norm(name);
    if (seen.has(key)) {
      duplicates.push(name);
    } else {
      seen.add(key);
      toAdd.push(name);
    }
  }
  return { toAdd, duplicates };
}

export interface AddMembersResult {
  added: Member[];
  addedCount: number;
  duplicates: string[];
}

/** Thêm thành viên từ chuỗi dán. Trả về số đã thêm + danh sách bị coi là trùng. */
export async function addMembers(
  ports: AppPorts,
  fundId: FundId,
  raw: string,
  allowDuplicates: boolean,
): Promise<AddMembersResult> {
  const pasted = parseNames(raw);
  const existing = await ports.members.listByFund(fundId);
  const { toAdd, duplicates } = planMemberAddition(
    existing.map((m) => m.name),
    pasted,
    allowDuplicates,
  );
  const added = toAdd.length ? await ports.members.addMany(fundId, toAdd) : [];
  return { added, addedCount: added.length, duplicates };
}

async function requireMemberInFund(
  ports: AppPorts,
  fundId: FundId,
  memberId: MemberId,
): Promise<Member> {
  const m = await ports.members.getById(memberId);
  if (!m || m.fundId !== fundId) {
    throw new DomainError("NOT_FOUND", "Không tìm thấy thành viên.");
  }
  return m;
}

/** Sửa tên thành viên (FR-04.3). */
export async function renameMember(
  ports: AppPorts,
  fundId: FundId,
  memberId: MemberId,
  rawName: string,
): Promise<Member> {
  await requireMemberInFund(ports, fundId, memberId);
  const parsed = memberNameSchema.safeParse(rawName);
  if (!parsed.success) {
    throw new DomainError(
      "VALIDATION",
      parsed.error.issues[0]?.message ?? "Tên không hợp lệ.",
    );
  }
  return ports.members.update(memberId, { name: parsed.data });
}

/** Đánh dấu ngưng/mở lại tham gia (FR-04.4) — không xóa dữ liệu. */
export async function setMemberActive(
  ports: AppPorts,
  fundId: FundId,
  memberId: MemberId,
  isActive: boolean,
): Promise<Member> {
  await requireMemberInFund(ports, fundId, memberId);
  return ports.members.update(memberId, { isActive });
}

/** Xóa thành viên — bị chặn nếu đã có giao dịch (BR-08/AT-06). */
export async function removeMember(
  ports: AppPorts,
  fundId: FundId,
  memberId: MemberId,
): Promise<void> {
  await requireMemberInFund(ports, fundId, memberId);
  await ports.members.remove(memberId);
}
