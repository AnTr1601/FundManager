import { redirect } from "next/navigation";
import { getPortsReady } from "@/lib/container";
import { getCurrentUser } from "@/lib/auth/session";
import { listMyFundsWithBalance } from "@/application/funds";
import { formatMoney } from "@/lib/format";
import { CreateFundForm } from "./create-fund-form";

export default async function FundsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const ports = await getPortsReady();
  const funds = await listMyFundsWithBalance(ports, user.id);

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <h1 className="text-xl font-bold tracking-tight">Quỹ của tôi</h1>

        {funds.length === 0 ? (
          <p className="text-foreground/60">
            Bạn chưa có quỹ nào. Tạo quỹ đầu tiên ở dưới.
          </p>
        ) : (
          <ul className="divide-y divide-foreground/10 rounded-lg border border-foreground/10">
            {funds.map(({ fund, totals }) => (
              <li
                key={fund.id}
                className="flex items-center justify-between gap-4 px-4 py-3"
              >
                <a
                  href={`/funds/${fund.id}`}
                  className="min-w-0 flex-1 hover:underline"
                >
                  <p className="truncate font-medium">{fund.name}</p>
                  {fund.description && (
                    <p className="truncate text-sm text-foreground/50">
                      {fund.description}
                    </p>
                  )}
                </a>
                <span
                  className={`shrink-0 font-semibold tabular-nums ${
                    totals.balance < 0 ? "text-red-600" : "text-foreground"
                  }`}
                >
                  {formatMoney(totals.balance)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Tạo quỹ mới</h2>
        <CreateFundForm />
      </section>
    </div>
  );
}
