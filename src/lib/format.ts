/**
 * Định dạng hiển thị theo quy ước Việt Nam (NFR-U5).
 * Tự nhóm nghìn để không phụ thuộc dữ liệu locale của môi trường chạy.
 */

/** 1250000 -> "1.250.000 đ"; -30000 -> "-30.000 đ"; 0 -> "0 đ". */
export function formatMoney(amount: number): string {
  const negative = amount < 0;
  const digits = Math.abs(Math.trunc(amount)).toString();
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${negative ? "-" : ""}${grouped} đ`;
}

/** 'YYYY-MM-DD' hoặc Date -> "DD/MM/YYYY". */
export function formatDate(date: Date | string): string {
  let year: number;
  let month: number;
  let day: number;

  if (typeof date === "string") {
    const [y, m, d] = date.split("-");
    year = Number(y);
    month = Number(m);
    day = Number(d);
  } else {
    year = date.getFullYear();
    month = date.getMonth() + 1;
    day = date.getDate();
  }

  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(day)}/${pad(month)}/${year}`;
}
