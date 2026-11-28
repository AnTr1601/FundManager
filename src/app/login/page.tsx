import { redirect } from "next/navigation";
import { DEV_USERS } from "@/lib/auth/constants";
import { setSession } from "@/lib/auth/session";

function safeNext(value: unknown): string {
  return typeof value === "string" && value.startsWith("/") ? value : "/funds";
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { next } = await searchParams;
  const dest = safeNext(next);

  async function login(formData: FormData) {
    "use server";
    const userId = String(formData.get("userId") ?? "");
    const target = safeNext(formData.get("next"));
    if (!DEV_USERS.some((u) => u.id === userId)) redirect("/login");
    await setSession(userId);
    redirect(target);
  }

  return (
    <main className="mx-auto flex max-w-md flex-1 flex-col justify-center gap-6 px-6 py-16">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Đăng nhập</h1>
        <p className="text-sm text-foreground/60">
          Giai đoạn phát triển: chọn một thủ quỹ giả lập để vào khu quản trị.
          Bản chính thức sẽ đăng nhập bằng Google.
        </p>
      </div>

      <form action={login}>
        <input type="hidden" name="next" value={dest} />
        <fieldset className="space-y-2">
          <legend className="sr-only">Chọn thủ quỹ giả lập</legend>
          {DEV_USERS.map((u) => (
            <button
              key={u.id}
              type="submit"
              name="userId"
              value={u.id}
              className="flex w-full items-center justify-between rounded-lg border border-foreground/15 px-4 py-3 text-left transition hover:border-foreground/40 hover:bg-foreground/5 focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              <span className="font-medium">{u.email}</span>
              <span aria-hidden className="text-foreground/40">
                →
              </span>
            </button>
          ))}
        </fieldset>
      </form>
    </main>
  );
}
