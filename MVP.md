# Quỹ Minh Bạch: kế hoạch MVP

> **Quỹ chung ai cũng xem được, thủ quỹ nhập trong 10 giây.**
> Mọi khoản thu chi đều công khai, có ảnh chứng từ, và không sửa xóa lén được.

Web app quản lý quỹ minh bạch cho một lớp học, câu lạc bộ, nhóm thiện nguyện nhỏ hoặc nhóm bạn.

---

## 1. Vấn đề

- Quỹ lớp hoặc quỹ CLB thường ghi bằng sổ tay, Excel hay tin nhắn Zalo, nên thành viên khó kiểm tra.
- Thủ quỹ mất công nhắc từng người đóng tiền và trả lời câu hỏi "tiền đi đâu rồi?".
- Dễ phát sinh nghi ngờ, mất lòng tin, ngay cả khi thủ quỹ hoàn toàn trung thực.

## 2. Người dùng

| Vai trò | Quyền |
|---|---|
| **Thủ quỹ (admin)** | Tạo quỹ, quản lý thành viên, ghi thu chi |
| **Thành viên** | Xem số dư, lịch sử, ai đã đóng và ai chưa |
| **Người ngoài** (tùy chọn) | Xem qua link công khai, ví dụ nhà tài trợ |

## 3. Tính năng MVP (3–6 tuần)

1. **Tạo quỹ:** tên quỹ, mô tả, danh sách thành viên, số tiền mỗi người cần đóng (nếu có).
2. **Ghi khoản thu:** chọn người đóng, nhập số tiền, đính kèm ảnh chuyển khoản. Tiền mặt được ghi không cần ảnh nhưng gắn nhãn "tiền mặt".
3. **Ghi khoản chi:** nhập số tiền, mục đích, danh mục (in ấn, ăn uống, quà...) và **bắt buộc có ảnh hóa đơn**.
4. **Trang tổng quan:** số dư hiện tại, tổng thu, tổng chi, biểu đồ chi theo danh mục.
5. **Danh sách đã đóng / chưa đóng:** tính năng "sát thủ", thủ quỹ đỡ phải đi nhắc từng người.
6. **Nhật ký thay đổi:** không cho xóa giao dịch, chỉ cho "hủy" kèm lý do. Mọi lần sửa đều lưu lại bản cũ. **Đây là phần tạo ra sự minh bạch thật sự.**
7. **Link chia sẻ** chỉ để xem, gửi vào nhóm Zalo.

## 4. Để sau (sau MVP)

- [ ] Mã **VietQR** cho từng thành viên, kèm nội dung chuyển khoản tự điền (ví dụ `QUY12A1 NGUYENVANA`).
- [ ] Tự động khớp giao dịch qua dịch vụ đọc biến động số dư (SePay, Casso… có webhook).
- [ ] Nhắc đóng tiền tự động.
- [ ] Xuất báo cáo PDF hoặc Excel cuối kỳ.
- [ ] Bình luận hoặc hỏi đáp dưới từng khoản chi.

## 5. Cơ sở dữ liệu tối thiểu

```sql
funds (
  id, name, description, owner_id,
  target_per_member, created_at
)

members (
  id, fund_id, name,
  role              -- 'treasurer' | 'member'
)

transactions (
  id, fund_id,
  type,             -- 'income' | 'expense'
  amount, member_id, category, note,
  receipt_url,
  payment_method,   -- 'transfer' | 'cash'
  status,           -- 'active' | 'voided'
  void_reason,
  created_by, created_at
)

audit_logs (
  id, transaction_id,
  action,           -- 'create' | 'update' | 'void'
  old_data, new_data,  -- JSON
  by_user, at
)
```

**Nguyên tắc:** số dư được **tính từ các giao dịch** (tổng thu trừ tổng chi của các giao dịch có `status = 'active'`), không lưu thành một con số riêng, để không bao giờ bị lệch.

## 6. Công nghệ

| Phần | Lựa chọn | Ghi chú |
|---|---|---|
| Frontend | Next.js / React + Tailwind | Mobile-first, vì người dùng mở từ link Zalo |
| Backend + DB + Auth + Storage | **Supabase** (Postgres) | Gói miễn phí dư dùng. Có thể thay bằng Firebase |
| Deploy | Vercel | Miễn phí cho dự án cá nhân |
| Đăng nhập | Email hoặc Google cho thủ quỹ | Thành viên xem qua link, không cần tài khoản |

## 7. Lộ trình

| Tuần | Việc |
|---|---|
| 1 | Thiết kế màn hình (vẽ tay hoặc Figma), dựng database, đăng nhập |
| 2 | Tạo quỹ, thêm thành viên, ghi thu chi, upload ảnh |
| 3 | Trang tổng quan, danh sách đã đóng / chưa đóng, link chia sẻ |
| 4 | Nhật ký thay đổi, cơ chế hủy thay cho xóa, chỉnh giao diện mobile |
| 5–6 | **Cho chính lớp hoặc CLB của mình dùng thật,** sửa theo phản hồi |

## 8. Những cái khó và cách xử lý

| Cái khó | Cách xử lý |
|---|---|
| **Nhập chậm:** quá 30 giây cho một khoản, thủ quỹ sẽ quay lại dùng Excel | Mở camera chụp hóa đơn ngay bước đầu, điền sẵn ngày giờ, nhớ danh mục hay dùng |
| **Ảnh nặng:** tốn dung lượng, tải chậm | Nén ảnh phía trình duyệt trước khi upload |
| **Quyền riêng tư:** ảnh chuyển khoản lộ số tài khoản và họ tên | Tùy chọn che thông tin. Ảnh chỉ thành viên xem, không công khai ra ngoài |
| **Giới hạn của minh bạch:** app chỉ biết những gì được nhập | Giai đoạn sau: tự khớp giao dịch ngân hàng qua webhook |
| **Tiền mặt:** nhiều lớp vẫn thu tiền mặt | Cho ghi không cần ảnh, gắn nhãn "tiền mặt" rõ ràng |
| **Sửa xóa lén** | Không có nút xóa. Chỉ "hủy" kèm lý do, mọi thay đổi vào `audit_logs` |

## 9. Tiêu chí thành công của MVP

- [ ] Một lớp hoặc CLB thật dùng liên tục ít nhất 1 tháng.
- [ ] Thủ quỹ ghi một khoản chi trong dưới 30 giây.
- [ ] Thành viên tự xem được số dư mà không cần hỏi thủ quỹ.
- [ ] Không có giao dịch nào bị xóa mất dấu vết.
