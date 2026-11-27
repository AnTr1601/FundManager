# Kế hoạch triển khai: Quỹ Minh Bạch (MVP)

**Nguồn:** `docs/01-hinh-thanh-y-tuong.md`, `docs/02-user-stories.md`, `docs/03-phan-tich-yeu-cau.md`, `docs/04-thiet-ke-he-thong.md`
**Ngày lập:** 26/11/2026

## Tổng quan

Xây web app Next.js quản lý quỹ minh bạch, mobile-first. Chiến lược: **kiến trúc ports & adapters**, chạy **adapter in-memory trước** (làm UI + logic, test được ngay), **ghép Supabase sau** bằng cách đổi biến `DATA_BACKEND` — không sửa UI/logic. Lớp miền thuần được phát triển **test-first (TDD)**. Cắt lát theo chiều dọc: mỗi task để lại hệ thống ở trạng thái chạy được.

## Quyết định kiến trúc

- **Ports & adapters:** `domain/` thuần (không import Next/Supabase); `ports/` là interface; `adapters/in-memory` (nay) và `adapters/supabase` (sau). Composition root: `lib/container.ts` chọn adapter theo `DATA_BACKEND`.
- **Số dư luôn tính, không lưu:** một hàm `computeTotals()` duy nhất (BR-02).
- **Bất biến minh bạch bằng hình dạng API:** port không có hàm xóa giao dịch; ghi giao dịch + nhật ký đi qua `FundUnitOfWork` nguyên tử (NFR-I2); nhật ký chỉ-thêm (BR-04).
- **Chống rò rỉ ở tầng server:** link công khai dùng hàm projection riêng — field ẩn không bao giờ rời máy chủ (AT-26), không ẩn bằng CSS.
- **Đăng nhập:** giai đoạn đầu dùng **đăng nhập giả lập dev**; lên Supabase thay bằng **Google OAuth**. App **không gửi email** nào.
- **VietQR:** sinh chuỗi EMVCo + CRC-16 bằng **hàm thuần** `domain/vietqr.ts` (TDD); app không giữ tiền (BR-11). Làm sớm, ngay sau ghi thu/chi.
- **Kiểm thử:** Vitest cho unit (miền) + **contract test** dùng chung mọi adapter; Playwright E2E ở cuối.

## Công nghệ & lệnh

- Next.js 15 (App Router) · TypeScript strict · Tailwind 4 · Zod · Vitest · (Playwright sau) · qrcode (vẽ QR) · browser-image-compression.
- Lệnh: `npm run dev` · `npm test` · `npm run test:watch` · `npm run typecheck` · `npm run lint` · `npm run build`.

## Danh sách task (chỉ mục)

Chi tiết + tiêu chí nghiệm thu: xem `tasks/todo.md`. Thứ tự theo phụ thuộc, có điểm dừng sau mỗi pha.

| Pha | Task | Lát |
|---|---|---|
| 0. Nền móng | T1 scaffold · T2 vitest · T3 types+format | hạ tầng |
| 1. Lõi miền | T4 balance · T5 payment-status · T6 txn-rules · T7 ports · T8 in-memory+seed · T9 contract test | lõi có test |
| 2. UI thủ quỹ | T10 dev-auth · T11 quỹ · T12 thành viên · T13 thu · T14 chi · **T15 VietQR domain · T16 VietQR UI** · T17 sửa/hủy+nhật ký | ghi chép |
| 3. Trang xem | T18 link chia sẻ · T19 tổng quan · T20 đã/chưa đóng · T21 danh sách+chi tiết · T22 nhật ký · T23 projection công khai | minh bạch |
| 4. Should | T24 biểu đồ · T25 lọc/tìm | hoàn thiện |
| 5. Supabase | T26 migration · T27 adapter supabase · T28 Google OAuth · T29 storage | ghép thật |
| 6. Phát hành | T30 E2E · T31 perf/a11y · T32 deploy+README+privacy | ship |

## Rủi ro & giảm thiểu

| Rủi ro | Mức | Giảm thiểu |
|---|---|---|
| Sai cấu hình RLS làm lộ dữ liệu khi lên Supabase | Cao | Projection + quyền đã cưỡng chế ở tầng ứng dụng từ đầu; T30 có test rò rỉ; rà policy trước khi dùng thật |
| VietQR sai chuẩn → không quét được | TB | T15 test-first với vector mẫu; quét thử bằng app ngân hàng thật ở T16 |
| Nhập liệu > 30s, thủ quỹ bỏ dùng | TB | Tối ưu luồng ghi chi (prefill, nhớ danh mục, camera ngay); đo ở T30 |
| Hợp đồng port thay đổi giữa chừng kéo theo cả 2 adapter | TB | Chốt port ở T7 (có contract test T9); đổi port là việc "Hỏi trước" |
| Đổi `number` ↔ `bigint` khi đọc Supabase lệch số | Thấp | Ép có kiểm tra ngưỡng; test ở T27 |

## Câu hỏi mở

- Đã hoãn: **đóng tiền định kỳ/nhiều kỳ** (mô hình "kỳ") → phiên bản sau; MVP mỗi quỹ = một đợt.
- 3 câu hỏi mở cuối `docs/04-thiet-ke-he-thong.md` (đăng nhập giả lập, code tiếng Anh/hiển thị tiếng Việt, biểu đồ tự vẽ) — chờ xác nhận lúc scaffold.
