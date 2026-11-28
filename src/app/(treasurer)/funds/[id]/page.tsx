import Link from "next/link";
import { redirect } from "next/navigation";
import { getPortsReady } from "@/lib/container";
import { getCurrentUser } from "@/lib/auth/session";
import { requireOwnedFund } from "@/application/guard";
import {
  listMembersForIncome,
  getFundTransactions,
  lastExpenseCategory,
  buildMemberQRs,
  listAuditLog,
} from "@/application/transactions";
import { DomainError } from "@/domain/errors";
import type { AuditAction, FundId } from "@/domain/types";
import { formatMoney, formatDate } from "@/lib/format";
import { methodLabel, categoryLabel, EXPENSE_CATEGORIES } from "@/lib/labels";
import { IncomeForm } from "./income-form";
import { ExpenseForm } from "./expense-form";
import { MemberQR } from "./member-qr";
import {
  addMembersAction,
  renameMemberAction,
  setMemberActiveAction,
  removeMemberAction,
  updateFundBankAction,
  editTxnAction,
  voidTxnAction,
} from "./actions";

const AUDIT_LABEL: Record<AuditAction, string> = {
  create: "Tạo",
  update: "Sửa",
  void: "Hủy",
};

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

function firstStr(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function FundDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const ports = await getPortsReady();

  try {
    await requireOwnedFund(ports, user.id, id as FundId);
  } catch (e) {
    if (e instanceof DomainError) redirect("/funds");
    throw e;
  }
  const fund = (await ports.funds.getById(id as FundId))!;
  const members = await ports.members.listByFund(fund.id);
  const incomeMembers = await listMembersForIncome(ports, fund.id);
  const { totals, transactions } = await getFundTransactions(ports, fund.id);
  const defaultCategory = await lastExpenseCategory(ports, fund.id);
  const qr = await buildMemberQRs(ports, fund.id);
  const audit = await listAuditLog(ports, fund.id);
  const today = ports.clock.today();
  const memberNames = new Map(members.map((m) => [m.id, m.name]));
  const txnWho = new Map(
    transactions.map((t) => [
      t.id,
      t.type === "income"
        ? (memberNames.get(t.memberId!) ?? "Khoản thu")
        : (t.purpose ?? "Khoản chi"),
    ]),
  );

  const sp = await searchParams;
  const err = firstStr(sp.err);
  const added = firstStr(sp.added);
  const skipped = firstStr(sp.skipped);
  const saved = firstStr(sp.saved);

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/funds"
          className="text-sm text-foreground/50 hover:underline"
        >
          ← Quỹ của tôi
        </Link>
        <div className="mt-1 flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-xl font-bold tracking-tight">{fund.name}</h1>
          <span
            className={`text-lg font-semibold tabular-nums ${
              totals.balance < 0 ? "text-red-600" : "text-foreground"
            }`}
          >
            Số dư: {formatMoney(totals.balance)}
          </span>
        </div>
      </div>

      {err && (
        <p
          role="alert"
          className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-700"
        >
          {err}
        </p>
      )}
      {added !== undefined && (
        <p
          role="status"
          className="rounded-lg border border-green-500/40 bg-green-500/10 px-4 py-2 text-sm text-green-700"
        >
          Đã thêm {added} thành viên
          {skipped && Number(skipped) > 0
            ? `, bỏ qua ${skipped} tên trùng`
            : ""}
          .
        </p>
      )}

      {saved === "bank" && (
        <p
          role="status"
          className="rounded-lg border border-green-500/40 bg-green-500/10 px-4 py-2 text-sm text-green-700"
        >
          Đã lưu tài khoản ngân hàng.
        </p>
      )}

      {/* ---- Tài khoản nhận tiền (VietQR) ---- */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Tài khoản nhận tiền (VietQR)</h2>
        <form
          action={updateFundBankAction}
          className="grid gap-3 sm:grid-cols-2"
        >
          <input type="hidden" name="fundId" value={fund.id} />
          <div className="space-y-1">
            <label htmlFor="bankBin" className="block text-sm font-medium">
              Mã BIN ngân hàng <span className="text-red-500">*</span>
            </label>
            <input
              id="bankBin"
              name="bankBin"
              defaultValue={fund.bankBin ?? ""}
              required
              inputMode="numeric"
              placeholder="VD: 970436 (Vietcombank)"
              className="w-full rounded-lg border border-foreground/15 bg-transparent px-3 py-2"
            />
          </div>
          <div className="space-y-1">
            <label
              htmlFor="bankAccountNumber"
              className="block text-sm font-medium"
            >
              Số tài khoản <span className="text-red-500">*</span>
            </label>
            <input
              id="bankAccountNumber"
              name="bankAccountNumber"
              defaultValue={fund.bankAccountNumber ?? ""}
              required
              className="w-full rounded-lg border border-foreground/15 bg-transparent px-3 py-2"
            />
          </div>
          <div className="space-y-1">
            <label
              htmlFor="bankAccountName"
              className="block text-sm font-medium"
            >
              Tên chủ tài khoản <span className="text-red-500">*</span>
            </label>
            <input
              id="bankAccountName"
              name="bankAccountName"
              defaultValue={fund.bankAccountName ?? ""}
              required
              maxLength={100}
              className="w-full rounded-lg border border-foreground/15 bg-transparent px-3 py-2"
            />
          </div>
          <div className="space-y-1">
            <label
              htmlFor="transferPrefix"
              className="block text-sm font-medium"
            >
              Tiền tố nội dung{" "}
              <span className="text-foreground/40">(tùy chọn)</span>
            </label>
            <input
              id="transferPrefix"
              name="transferPrefix"
              defaultValue={fund.transferPrefix ?? ""}
              maxLength={20}
              placeholder="VD: QUY12A1"
              className="w-full rounded-lg border border-foreground/15 bg-transparent px-3 py-2"
            />
          </div>
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="rounded-lg bg-foreground px-4 py-2 font-medium text-background"
            >
              Lưu tài khoản
            </button>
          </div>
        </form>

        <div className="space-y-2">
          <h3 className="font-medium">Mã QR đóng tiền</h3>
          {qr.configured ? (
            <MemberQR items={qr.items} />
          ) : (
            <p className="text-foreground/60">
              Chưa gắn tài khoản ngân hàng. Điền thông tin ở trên và lưu để hiện
              mã QR đóng tiền cho thành viên.
            </p>
          )}
        </div>
      </section>

      {/* ---- Ghi khoản thu ---- */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Ghi khoản thu</h2>
        {incomeMembers.length === 0 ? (
          <p className="text-foreground/60">
            Chưa có thành viên đang tham gia. Thêm thành viên ở dưới trước.
          </p>
        ) : (
          <IncomeForm
            fundId={fund.id}
            members={incomeMembers}
            today={today}
          />
        )}
      </section>

      {/* ---- Ghi khoản chi ---- */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Ghi khoản chi</h2>
        <ExpenseForm
          fundId={fund.id}
          today={today}
          balance={totals.balance}
          defaultCategory={defaultCategory}
        />
      </section>

      {/* ---- Giao dịch ---- */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">
          Giao dịch{" "}
          <span className="text-sm font-normal text-foreground/50">
            ({transactions.length})
          </span>
        </h2>
        {transactions.length === 0 ? (
          <p className="text-foreground/60">Chưa có giao dịch nào.</p>
        ) : (
          <ul className="divide-y divide-foreground/10 rounded-lg border border-foreground/10">
            {transactions.map((t) => {
              const voided = t.status === "voided";
              const who =
                t.type === "income"
                  ? (memberNames.get(t.memberId!) ?? "Khoản thu")
                  : (t.purpose ?? "Khoản chi");
              const meta = [
                formatDate(t.txnDate),
                t.type === "expense" ? categoryLabel(t.category) : "",
                methodLabel(t.paymentMethod),
                t.noReceipt ? "Không có chứng từ" : "",
                !voided && t.updatedAt ? "Đã sửa" : "",
                voided ? "Đã hủy" : "",
              ]
                .filter(Boolean)
                .join(" · ");
              return (
                <li key={t.id} className="space-y-2 px-4 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p
                        className={`truncate font-medium ${
                          voided ? "text-foreground/40 line-through" : ""
                        }`}
                      >
                        {who}
                      </p>
                      <p className="text-xs text-foreground/50">{meta}</p>
                    </div>
                    <span
                      className={`shrink-0 font-semibold tabular-nums ${
                        voided
                          ? "text-foreground/40 line-through"
                          : t.type === "expense"
                            ? "text-red-600"
                            : "text-green-700"
                      }`}
                    >
                      {t.type === "income" ? "+" : "−"}
                      {formatMoney(t.amount)}
                    </span>
                  </div>

                  {!voided && (
                    <div className="flex flex-wrap gap-4 text-sm">
                      <details className="min-w-0">
                        <summary className="cursor-pointer text-foreground/60">
                          Sửa
                        </summary>
                        <form
                          action={editTxnAction}
                          className="mt-2 flex flex-wrap items-end gap-2 rounded-lg border border-foreground/10 p-3"
                        >
                          <input type="hidden" name="fundId" value={fund.id} />
                          <input type="hidden" name="txnId" value={t.id} />
                          <label className="text-xs">
                            Số tiền
                            <input
                              name="amount"
                              type="number"
                              min={1}
                              step={1}
                              defaultValue={t.amount}
                              required
                              className="block w-32 rounded-md border border-foreground/15 bg-transparent px-2 py-1"
                            />
                          </label>
                          <label className="text-xs">
                            Ngày
                            <input
                              name="txnDate"
                              type="date"
                              defaultValue={t.txnDate}
                              max={today}
                              required
                              className="block rounded-md border border-foreground/15 bg-transparent px-2 py-1"
                            />
                          </label>
                          {t.type === "expense" && (
                            <>
                              <label className="text-xs">
                                Mục đích
                                <input
                                  name="purpose"
                                  defaultValue={t.purpose ?? ""}
                                  maxLength={200}
                                  className="block rounded-md border border-foreground/15 bg-transparent px-2 py-1"
                                />
                              </label>
                              <label className="text-xs">
                                Danh mục
                                <select
                                  name="category"
                                  defaultValue={t.category ?? "other"}
                                  className="block rounded-md border border-foreground/15 bg-transparent px-2 py-1"
                                >
                                  {EXPENSE_CATEGORIES.map((c) => (
                                    <option key={c.value} value={c.value}>
                                      {c.label}
                                    </option>
                                  ))}
                                </select>
                              </label>
                            </>
                          )}
                          <label className="text-xs">
                            Ghi chú
                            <input
                              name="note"
                              defaultValue={t.note ?? ""}
                              maxLength={500}
                              className="block rounded-md border border-foreground/15 bg-transparent px-2 py-1"
                            />
                          </label>
                          <button
                            type="submit"
                            className="rounded-md bg-foreground px-3 py-1 text-background"
                          >
                            Lưu
                          </button>
                        </form>
                      </details>

                      <details className="min-w-0">
                        <summary className="cursor-pointer text-red-600">
                          Hủy
                        </summary>
                        <form
                          action={voidTxnAction}
                          className="mt-2 flex flex-wrap items-end gap-2 rounded-lg border border-red-500/20 p-3"
                        >
                          <input type="hidden" name="fundId" value={fund.id} />
                          <input type="hidden" name="txnId" value={t.id} />
                          <label className="text-xs">
                            Lý do hủy (5–200 ký tự)
                            <input
                              name="reason"
                              required
                              minLength={5}
                              maxLength={200}
                              className="block w-64 rounded-md border border-foreground/15 bg-transparent px-2 py-1"
                            />
                          </label>
                          <button
                            type="submit"
                            className="rounded-md bg-red-600 px-3 py-1 text-white"
                          >
                            Xác nhận hủy
                          </button>
                        </form>
                      </details>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ---- Nhật ký thay đổi ---- */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">
          Nhật ký thay đổi{" "}
          <span className="text-sm font-normal text-foreground/50">
            ({audit.length})
          </span>
        </h2>
        {audit.length === 0 ? (
          <p className="text-foreground/60">Chưa có thay đổi nào.</p>
        ) : (
          <ul className="divide-y divide-foreground/10 rounded-lg border border-foreground/10 text-sm">
            {audit.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between gap-3 px-4 py-2"
              >
                <span>
                  <span className="font-medium">{AUDIT_LABEL[a.action]}</span>
                  {" · "}
                  {txnWho.get(a.transactionId) ?? "Giao dịch"}
                </span>
                <span className="shrink-0 text-xs text-foreground/50">
                  {formatDate(a.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ---- Thành viên ---- */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">
          Thành viên{" "}
          <span className="text-sm font-normal text-foreground/50">
            ({members.length})
          </span>
        </h2>

        {members.length === 0 ? (
          <p className="text-foreground/60">
            Chưa có thành viên. Dán danh sách tên ở dưới.
          </p>
        ) : (
          <ul className="divide-y divide-foreground/10 rounded-lg border border-foreground/10">
            {members.map((m) => (
              <li
                key={m.id}
                className="flex flex-wrap items-center gap-2 px-3 py-2"
              >
                <form
                  action={renameMemberAction}
                  className="flex min-w-0 flex-1 items-center gap-2"
                >
                  <input type="hidden" name="fundId" value={fund.id} />
                  <input type="hidden" name="memberId" value={m.id} />
                  <input
                    name="name"
                    defaultValue={m.name}
                    required
                    maxLength={100}
                    aria-label={`Tên thành viên ${m.name}`}
                    className={`min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 hover:border-foreground/15 focus:border-foreground/30 focus-visible:outline-none ${
                      m.isActive ? "" : "text-foreground/40 line-through"
                    }`}
                  />
                  <button
                    type="submit"
                    className="rounded-md px-2 py-1 text-sm text-foreground/60 hover:bg-foreground/10"
                  >
                    Lưu
                  </button>
                </form>

                {!m.isActive && (
                  <span className="rounded bg-foreground/10 px-2 py-0.5 text-xs text-foreground/60">
                    Ngưng
                  </span>
                )}

                <form action={setMemberActiveAction}>
                  <input type="hidden" name="fundId" value={fund.id} />
                  <input type="hidden" name="memberId" value={m.id} />
                  <input
                    type="hidden"
                    name="active"
                    value={m.isActive ? "false" : "true"}
                  />
                  <button
                    type="submit"
                    className="rounded-md px-2 py-1 text-sm text-foreground/60 hover:bg-foreground/10"
                  >
                    {m.isActive ? "Ngưng" : "Mở lại"}
                  </button>
                </form>

                <form action={removeMemberAction}>
                  <input type="hidden" name="fundId" value={fund.id} />
                  <input type="hidden" name="memberId" value={m.id} />
                  <button
                    type="submit"
                    className="rounded-md px-2 py-1 text-sm text-red-600 hover:bg-red-500/10"
                  >
                    Xóa
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ---- Thêm thành viên ---- */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Thêm thành viên</h2>
        <form action={addMembersAction} className="space-y-3">
          <input type="hidden" name="fundId" value={fund.id} />
          <div className="space-y-1">
            <label htmlFor="names" className="block text-sm font-medium">
              Dán danh sách — mỗi dòng một tên
            </label>
            <textarea
              id="names"
              name="names"
              rows={5}
              placeholder={"Nguyễn An\nTrần Bình\nLê Chi"}
              className="w-full rounded-lg border border-foreground/15 bg-transparent px-3 py-2 focus-visible:outline-2 focus-visible:outline-offset-2"
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="allowDuplicates" />
            Cho phép thêm cả tên trùng
          </label>
          <button
            type="submit"
            className="rounded-lg bg-foreground px-4 py-2 font-medium text-background"
          >
            Thêm thành viên
          </button>
        </form>
      </section>
    </div>
  );
}
