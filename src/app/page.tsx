export default function Home() {
  return (
    <main className="mx-auto flex max-w-xl flex-1 flex-col justify-center gap-6 px-6 py-16">
      <div className="space-y-3">
        <h1 className="text-3xl font-bold tracking-tight">Quỹ Minh Bạch</h1>
        <p className="text-lg text-foreground/70">
          Quỹ chung ai cũng xem được, thủ quỹ nhập trong 10 giây.
        </p>
      </div>
      <p className="text-foreground/60">
        Web app quản lý quỹ minh bạch cho lớp học, câu lạc bộ và nhóm nhỏ. Mọi
        khoản thu chi đều công khai, có ảnh chứng từ, và không sửa xóa lén được.
      </p>
      <p className="text-sm text-foreground/40">
        Đang trong quá trình xây dựng — Pha 0: nền móng.
      </p>
    </main>
  );
}
