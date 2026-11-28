import { redirect } from "next/navigation";
import { getCurrentUser, clearSession } from "@/lib/auth/session";

/**
 * Khung cho nhóm trang thủ quỹ. Lớp chặn thứ hai (sau middleware):
 * xác thực user thật từ cookie; không hợp lệ → về /login.
 */
export default async function TreasurerLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  async function logout() {
    "use server";
    await clearSession();
    redirect("/login");
  }

  return (
    <div className="min-h-full">
      <header className="flex items-center justify-between border-b border-foreground/10 px-6 py-3">
        <span className="font-semibold">Quỹ Minh Bạch</span>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-foreground/60">{user.email}</span>
          <form action={logout}>
            <button
              type="submit"
              className="rounded-md border border-foreground/15 px-3 py-1 transition hover:bg-foreground/5"
            >
              Đăng xuất
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-8">{children}</main>
    </div>
  );
}
