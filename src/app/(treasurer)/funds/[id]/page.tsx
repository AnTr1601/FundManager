import Link from "next/link";
import { redirect } from "next/navigation";
import { getPortsReady } from "@/lib/container";
import { getCurrentUser } from "@/lib/auth/session";
import { requireOwnedFund } from "@/application/guard";
import {
  listMembersForIncome,
  getFundTransactions,
  lastExpenseCategory,
} from "@/application/transactions";
import { DomainError } from "@/domain/errors";
import type { FundId } from "@/domain/types";
import { formatMoney, formatDate } from "@/lib/format";
import { methodLabel, categoryLabel } from "@/lib/labels";
import { IncomeForm } from "./income-form";
import { ExpenseForm } from "./expense-form";
import {
  addMembersAction,
  renameMemberAction,
  setMemberActiveAction,
  removeMemberAction,
} from "./actions";

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
  const today = ports.clock.today();
  const memberNames = new Map(members.map((m) => [m.id, m.name]));

  const sp = await searchParams;
  const err = firstStr(sp.err);
  const added = firstStr(sp.added);
  const skipped = firstStr(sp.skipped);

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
                voided ? "Đã hủy" : "",
              ]
                .filter(Boolean)
                .join(" · ");
              return (
                <li
                  key={t.id}
                  className="flex items-center justify-between gap-3 px-4 py-2"
                >
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
                </li>
              );
            })}
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
