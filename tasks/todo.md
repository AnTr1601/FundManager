# Backlog thực thi: Quỹ Minh Bạch (MVP)

Thứ tự theo phụ thuộc. Mỗi task: **AC** = tiêu chí chấp nhận, **V** = cách kiểm chứng, **Dep** = phụ thuộc, **Size**. Mặc định mọi task đều: `npm run typecheck` + `npm test` xanh trước khi commit; commit riêng cho mỗi task.

---

## Pha 0 — Nền móng ✅ HOÀN THÀNH

### ✅ T1: Scaffold Next.js + Tailwind + lint
- AC: Dự án Next.js 15 App Router + TS strict + Tailwind 4 khởi động; trang chủ tạm hiển thị "Quỹ Minh Bạch"; cấu trúc thư mục `src/{app,domain,ports,adapters,application,lib,components}` theo Bước 4.
- V: `npm run dev` mở được; `npm run build` thành công; `npm run lint` sạch.
- Dep: None · Size: M

### ✅ T2: Vitest + script kiểm thử
- AC: Cài Vitest; có `npm test`, `npm run test:watch`, `npm run typecheck`; một test mẫu xanh; `tsconfig` bật `strict` + alias `@/*`.
- V: `npm test` xanh; `npm run typecheck` không lỗi.
- Dep: T1 · Size: S

### ✅ T3: Kiểu miền + tiện ích định dạng (TDD)
- AC: `domain/types.ts` (Fund, Member, Transaction, AuditLog, enums, branded id, trường ngân hàng); `domain/errors.ts`; `domain/money.ts` (`assertValidAmount`, add/sub); `lib/format.ts` (`formatMoney` → `1.250.000 đ`, `formatDate` → `21/11/2026`).
- AC: Test cho money + format phủ biên (0, âm, >1e9, phân cách nghìn).
- V: `npm test` xanh (các test format/money).
- Dep: T2 · Size: M

### Điểm dừng 0 ✅
- [x] Build sạch, test xanh (10 test), cấu trúc thư mục đúng Bước 4. Chờ rà soát với người dùng.

---

## Pha 1 — Lõi miền + adapter in-memory (test-first)

### T4: Tính số dư (TDD)
- AC: `domain/balance.ts` `computeTotals(txns)` = Σ thu(active) − Σ chi(active); bỏ qua `voided`; số dư có thể âm.
- V: Test tái hiện **AT-22** (thu 4.000.000, chi 1.250.000, một thu 100.000 đã hủy → 2.750.000).
- Dep: T3 · Size: S

### T5: Trạng thái đóng tiền (TDD)
- AC: `domain/payment-status.ts` `computeMemberPaid`, `computeMemberStatus` (paid/partial/unpaid; null khi target=0).
- V: Test tái hiện **AT-23** (mức 100.000: A đóng đủ→paid, B 50.000→partial, C 0→unpaid).
- Dep: T3 · Size: S

### T6: Bất biến giao dịch (TDD)
- AC: `domain/transaction-rules.ts`: `voidTransaction` (bắt buộc lý do 5–200, chỉ active), `editTransaction` (chỉ active, cấm đổi type), `assertReceiptRule` (BR-05/06), `assertTxnDateNotFuture` (BR-07). **Không có hàm xóa.**
- V: Test các nhánh hợp lệ/ném lỗi (AT-07, AT-10, AT-11, AT-17 ở mức logic).
- Dep: T3 · Size: M

### T7: Định nghĩa ports (hợp đồng)
- AC: `ports/repositories.ts` (Fund/Member/Transaction/AuditLog repo + `FundUnitOfWork`), `ports/services.ts` (Clock, IdGenerator, TokenGenerator, AuthPort), `ports/storage.ts` (StoragePort). Kiểu vào/ra tách biệt, `Paginated<T>`, không có hàm xóa giao dịch/sửa nhật ký.
- V: `npm run typecheck` xanh (chỉ interface, chưa hiện thực).
- Dep: T3 · Size: S

### T8: Adapter in-memory + container + seed
- AC: `adapters/in-memory/*` hiện thực đủ ports; `FundUnitOfWork` ghi giao dịch + nhật ký nguyên tử; `lib/container.ts` chọn theo `DATA_BACKEND` (mặc định in-memory); seed một quỹ mẫu + vài giao dịch.
- V: App chạy với dữ liệu seed; `npm test` xanh.
- Dep: T7, T6 · Size: M

### T9: Bộ contract test cho adapter
- AC: `tests/contract/*` chạy với **bất kỳ** adapter: không có đường xóa giao dịch; tạo→sửa→hủy sinh đúng 3 bản ghi nhật ký create/update/void; rotate token làm token cũ vô hiệu; public token tắt thì không trả dữ liệu.
- V: Chạy bộ contract với in-memory → xanh (**AT-21, AT-27, AT-28** ở mức adapter).
- Dep: T8 · Size: M

### Điểm dừng 1 (lõi)
- [ ] Toàn bộ logic minh bạch có test xanh; adapter in-memory pass contract test. Rà soát với người dùng.

---

## Pha 2 — UI thủ quỹ (dev auth)

### T10: Đăng nhập giả lập dev + chặn truy cập
- AC: Màn hình chọn/nhập user dev → đặt cookie phiên; `AuthPort` in-memory; middleware chặn trang `(treasurer)/*`, chưa đăng nhập thì chuyển về `/login` (**AT-01**).
- V: Truy cập trang quản trị khi chưa đăng nhập → bị chuyển hướng; đăng nhập xong vào được.
- Dep: T8 · Size: M

### T11: Tạo quỹ + danh sách quỹ
- AC: Server action tạo quỹ (Zod: tên bắt buộc 1–100, mô tả ≤500, mức đóng ≥0), tự sinh member/public token; trang danh sách quỹ của tôi; số dư 0 khi mới tạo (**AT-03, AT-04**).
- V: Tạo quỹ tên trống → lỗi; tạo "Quỹ 12A1" mức 100.000 → xuất hiện, số dư 0.
- Dep: T10 · Size: M

### T12: Quản lý thành viên
- AC: Dán hàng loạt (mỗi dòng một tên, bỏ dòng trống/khoảng trắng), cảnh báo trùng cho chọn bỏ qua/vẫn thêm; sửa tên; đánh dấu ngưng tham gia; không xóa được thành viên đã có giao dịch (**AT-05, AT-06**).
- V: Dán 40 tên (2 dòng trống, 1 trùng) → thêm 39 + cảnh báo 1; thử xóa thành viên có giao dịch → bị chặn.
- Dep: T11 · Size: M

### T13: Ghi khoản thu (chuyển khoản/tiền mặt) + nén ảnh
- AC: Form thu: chọn thành viên, số tiền (prefill phần còn thiếu của mức đóng), hình thức; chuyển khoản **bắt buộc ảnh**, tiền mặt không; nén ảnh phía trình duyệt ≤500KB/1600px; ngày mặc định hôm nay, không cho tương lai; số tiền nguyên dương (**AT-07, AT-08, AT-09, AT-10, AT-14**).
- V: Ghi thu CK không ảnh → chặn; tiền mặt 100.000 không ảnh → lưu, nhãn "Tiền mặt", số dư +100.000; nhập 0/−5000/"abc" → lỗi.
- Dep: T11, T6 · Size: M

### T14: Ghi khoản chi (danh mục, quy tắc ảnh, vượt số dư)
- AC: Form chi: số tiền, mục đích, danh mục (nhớ danh mục gần nhất), ngày; **ảnh hóa đơn bắt buộc** trừ khi tick "Không có hóa đơn" + lý do ≥5; cảnh báo + xác nhận khi vượt số dư (**AT-11, AT-12, AT-13**).
- V: Chi không ảnh/không tick → chặn; tick + lý do → lưu, nhãn "Không có chứng từ"; số dư 50.000 chi 80.000 → cảnh báo, xác nhận → −30.000 đỏ.
- Dep: T13 · Size: M

### Điểm dừng 2 (ghi chép)
- [ ] Tạo quỹ → thêm thành viên → ghi thu/chi chạy thông suốt với dữ liệu in-memory. Rà soát.

### T15: VietQR — lõi sinh chuỗi (TDD)
- AC: `domain/vietqr.ts` sinh chuỗi **EMVCo/Napas VietQR** (NAPAS247, VND 704) + **CRC-16/CCITT**; `buildTransferContent(prefix, memberName)` bỏ dấu, viết hoa, cắt độ dài.
- V: Test với **vector mẫu** (BIN + số TK + số tiền + nội dung → chuỗi + CRC đúng) (**AT-33**).
- Dep: T3 · Size: M

### T16: VietQR — gắn tài khoản + hiển thị QR
- AC: Form thủ quỹ nhập ngân hàng (BIN)/số TK/tên/tiền tố; trang đóng tiền hiển thị QR (lib `qrcode`) điền sẵn số tiền còn thiếu + nội dung; nút "Lưu ảnh QR"/"Sao chép nội dung"; chưa gắn TK thì ẩn QR + hướng dẫn (**AT-32, AT-34**).
- V: Quỹ mức 100.000, A đã đóng 30.000 → QR số tiền 70.000, nội dung `[prefix] A`; quét thử bằng app ngân hàng thật.
- Dep: T15, T11 · Size: M

### T17: Sửa / hủy giao dịch + nhật ký
- AC: Sửa giao dịch active (không đổi type) → ghi nhật ký update (old/new), nhãn "Đã sửa"; hủy bắt buộc lý do → status voided, gạch ngang, không tính số dư, nhãn "Đã hủy"; không có nút xóa (**AT-16, AT-17, AT-18**).
- V: Sửa 150.000→1.500.000: số dư cập nhật + nhật ký có cả cũ/mới; hủy không lý do → chặn; hủy có lý do → trừ số dư + cập nhật trạng thái đóng.
- Dep: T14 · Size: M

### Điểm dừng 3 (minh bạch + VietQR)
- [ ] Sửa/hủy + nhật ký hoạt động; VietQR quét được. Rà soát.

---

## Pha 3 — Trang xem theo token

### T18: Quản lý link chia sẻ
- AC: Hiển thị link thành viên + công khai; bật/tắt công khai (mặc định tắt); "Tạo link mới" vô hiệu token cũ; nút sao chép (**AT-27, AT-28**).
- V: Tạo link mới → mở link cũ thấy "Link không còn hiệu lực"; mở link công khai khi tắt → báo tương tự.
- Dep: T11 · Size: M

### T19: Trang token + tổng quan (thành viên)
- AC: Route `/f/[token]` phân giải token (thành viên) → trang tổng quan: số dư, tổng thu/chi, số người đã đóng/tổng, 5 giao dịch gần nhất; định dạng tiền VN; không cần đăng nhập; token sai → trang "Link không còn hiệu lực" (**AT-22, AT-25**).
- V: Mở link thành viên trên thiết bị chưa đăng nhập → xem đầy đủ, không có nút ghi/sửa.
- Dep: T18, T4 · Size: M

### T20: Danh sách đã đóng / chưa đóng
- AC: Danh sách thành viên kèm trạng thái + bộ lọc + đếm "32/40 đã đóng"; nút "Sao chép danh sách chưa đóng" (**AT-23, AT-24**); quỹ không mức đóng → chỉ hiện tổng đã đóng.
- V: Sao chép → clipboard đúng tên người chưa/đóng thiếu.
- Dep: T19, T5 · Size: M

### T21: Danh sách + chi tiết giao dịch + xem ảnh
- AC: Danh sách giao dịch (thu +xanh/chi −đỏ, nhãn Tiền mặt/Không chứng từ/Đã sửa/Đã hủy), phân trang 20; trang chi tiết đủ trường + ảnh; xem ảnh toàn màn hình phóng to.
- V: Mở chi tiết một giao dịch → đủ thông tin + ảnh; danh sách phân trang đúng.
- Dep: T19 · Size: M

### T22: Trang nhật ký
- AC: Liệt kê nhật ký mới nhất trước, phân trang 20; hiển thị thời điểm/người/loại/trước→sau; chỉ đọc (**AT-20, AT-21** ở mức hiển thị).
- V: Tạo/sửa/hủy một giao dịch → nhật ký đúng 3 dòng theo thứ tự.
- Dep: T19 · Size: S

### T23: Projection link công khai (chống rò rỉ)
- AC: `toPublicView` loại bỏ tên thành viên, ảnh/ghi chú khoản thu, danh sách đóng tiền; khoản thu hiện "Thành viên đóng quỹ: X"; VietQR **không** hiện ở link công khai; trang gắn `noindex` (**AT-26**).
- V: Mở link công khai → kiểm tra **response mạng không chứa** field ẩn (không chỉ ẩn trên UI).
- Dep: T19, T21, T22 · Size: M

### Điểm dừng 4 (minh bạch công khai)
- [ ] Xem theo link thành viên/công khai đầy đủ; test rò rỉ đạt. Rà soát.

---

## Pha 4 — Should

### T24: Biểu đồ chi theo danh mục
- AC: Thanh ngang SVG/CSS theo danh mục, số tiền + %, giảm dần, bỏ giao dịch đã hủy (**AT-30**).
- V: Chi Ăn uống 600.000, In ấn 400.000 → 60% / 40%.
- Dep: T21 · Size: S

### T25: Lọc + tìm giao dịch
- AC: Lọc Thu/Chi/Đã hủy, danh mục, khoảng ngày (kết hợp); tìm từ khóa trong mục đích/ghi chú/tên, **không phân biệt dấu** tiếng Việt + hoa thường (**AT-31**).
- V: Tìm "nuoc" → ra giao dịch "Mua nước".
- Dep: T21 · Size: M

### Điểm dừng 5 (hoàn thiện Should)
- [ ] Biểu đồ + lọc/tìm hoạt động. Rà soát.

---

## Pha 5 — Ghép Supabase (đổi DATA_BACKEND)

### T26: Migration schema + RLS + trigger
- AC: `supabase/migrations/*.sql`: bảng theo Bước 3 §6; ràng buộc (amount>0, no DELETE policy cho transactions/audit_logs); RLS mọi bảng; trigger ghi `audit_logs` tự động khi INSERT/UPDATE transactions (FR-10.3, NFR-I3). *Lưu ý: nếu quá lớn, tách thành migration schema / RLS / trigger.*
- V: Áp lên project Supabase cloud; thử `DELETE` transaction / `UPDATE` audit_logs bằng tài khoản thủ quỹ → bị từ chối (**AT-19, AT-20**).
- Dep: T9 · Size: L (có thể tách)

### T27: Adapter Supabase (pass contract test)
- AC: `adapters/supabase/*` hiện thực đủ ports; `DATA_BACKEND=supabase` chạy được; **chạy lại bộ contract test T9 → xanh**; xử lý bigint→number có ngưỡng.
- V: Contract test xanh với cả in-memory lẫn supabase; app chạy thật.
- Dep: T26, T9 · Size: L (có thể tách)

### T28: Google OAuth (thay dev login)
- AC: Đăng nhập Google qua Supabase Auth; phiên ≥7 ngày; đăng xuất; thay `AuthPort` dev (FR-01) (**AT-02**).
- V: Đăng nhập Google → vào danh sách quỹ; đăng xuất hoạt động.
- Dep: T27 · Size: M

### T29: Storage ảnh (bucket riêng tư + signed URL)
- AC: `StoragePort` Supabase: lưu bucket riêng tư, trả signed URL ≤1h; không URL công khai vĩnh viễn (NFR-S4) (**AT-15**).
- V: Mở URL ảnh sau khi signed URL hết hạn → không truy cập được.
- Dep: T27 · Size: M

### Điểm dừng 6 (chạy thật)
- [ ] App chạy trên Supabase thật, contract test xanh, RLS chặn xóa/sửa nhật ký. Rà soát kỹ RLS.

---

## Pha 6 — Phát hành

### T30: E2E Playwright + test rò rỉ
- AC: Kịch bản: thiết lập quỹ <3 phút; ghi chi <30s/≤6 chạm; test rò rỉ link công khai (**AT-26**); thu hồi link (**AT-27**).
- V: `npx playwright test` xanh.
- Dep: T23, T28 · Size: M

### T31: Hiệu năng + a11y
- AC: Lighthouse mobile: LCP ≤2,5s (NFR-P1), a11y ≥90 (NFR-U9); JS tải đầu ≤250KB; tương phản AT-N9; không cuộn ngang ở 360px.
- V: Báo cáo Lighthouse đạt ngưỡng; nạp 200 thành viên/2.000 giao dịch vẫn mượt (AT-N2).
- Dep: T30 · Size: M

### T32: Triển khai Vercel + README + trang riêng tư
- AC: Deploy Vercel (biến môi trường Supabase); README cài đặt/chạy (NFR-M1); trang "Chính sách quyền riêng tư" ngắn (§6.3).
- V: URL công khai chạy được end-to-end trên điện thoại; mở được trong trình duyệt Zalo (AT-N7).
- Dep: T31 · Size: M

### Điểm dừng 7 (nghiệm thu MVP)
- [ ] Đạt điều kiện nghiệm thu §11.3 (Must FR-01→14 + FR-19, AT-01→29 + AT-32→34). Sẵn sàng cho lớp/CLB dùng thử.
