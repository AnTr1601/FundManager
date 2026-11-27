# Bước 4: Thiết kế hệ thống (System Design)

**Dự án:** Quỹ Minh Bạch
**Phiên bản tài liệu:** 1.0
**Tài liệu liên quan:** `01-hinh-thanh-y-tuong.md`, `02-user-stories.md`, `03-phan-tich-yeu-cau.md`

> Tài liệu này biến yêu cầu (Bước 3) thành một bản thiết kế kỹ thuật có thể lập trình được: kiến trúc, cấu trúc thư mục, mô hình miền, hợp đồng giao diện (interface/port), chiến lược kiểm thử và ranh giới làm việc. Đây là cơ sở để chia task (Bước 5) và lập trình (Bước 6+).

---

## 1. Mục tiêu và nguyên tắc thiết kế

### 1.1. Mục tiêu

Xây một web app mobile-first giúp thủ quỹ ghi thu chi kèm chứng từ, thành viên xem qua link không cần tài khoản, mọi thay đổi có vết và không xóa được. Chi tiết xem Bước 1–3.

### 1.2. Năm nguyên tắc dẫn đường

| # | Nguyên tắc | Hệ quả thiết kế |
|---|---|---|
| 1 | **Số dư là chân lý được tính, không lưu** (BR-02) | Mọi nơi tính `Σ thu(active) − Σ chi(active)` từ một chỗ duy nhất trong lớp miền. Không có cột `balance`. |
| 2 | **Minh bạch cưỡng chế ở tầng dưới** (BR-03, BR-04, NFR-I3) | Không có đường xóa giao dịch; nhật ký chỉ-thêm. Ban đầu cưỡng chế ở tầng ứng dụng; khi lên Supabase thì thêm RLS/trigger (phòng thủ nhiều lớp). |
| 3 | **Tách miền khỏi hạ tầng (ports & adapters)** | Logic nghiệp vụ thuần TypeScript, không phụ thuộc Next.js hay Supabase. Nhờ đó chạy **in-memory trước, ghép Supabase sau** mà không sửa UI/logic. |
| 4 | **Hợp đồng trước, hiện thực sau** (contract-first) | Định nghĩa `interface` port + kiểu vào/ra trước, rồi mới viết adapter. Một bộ "contract test" dùng chung cho mọi adapter. |
| 5 | **Kiểm tra ở ranh giới, tin tưởng bên trong** | Validate (Zod) tại server action / API route. Sau khi qua cổng, code trong miền tin vào kiểu dữ liệu. |

---

## 2. Kiến trúc tổng thể

### 2.1. Mô hình phân tầng (hexagonal / ports & adapters)

```
┌─────────────────────────────────────────────────────────────┐
│  TẦNG GIAO DIỆN (UI)                                         │
│  Next.js App Router · React Server/Client Components         │
│  Trang thủ quỹ (cần đăng nhập) · Trang xem theo token        │
└───────────────┬─────────────────────────────────────────────┘
                │ gọi
┌───────────────▼─────────────────────────────────────────────┐
│  TẦNG ỨNG DỤNG (Application / Use-cases)                     │
│  Server Actions + API Route Handlers                        │
│  Validate đầu vào (Zod) · Kiểm tra quyền · Điều phối         │
└───────────────┬─────────────────────────────────────────────┘
                │ dùng
┌───────────────▼─────────────────────────────────────────────┐
│  TẦNG MIỀN (Domain) — THUẦN, KHÔNG PHỤ THUỘC HẠ TẦNG        │
│  Kiểu dữ liệu · Quy tắc nghiệp vụ · Tính số dư, trạng thái   │
│  đóng tiền · Định dạng tiền/ngày · Kiểm tra bất biến         │
└───────────────┬─────────────────────────────────────────────┘
                │ phụ thuộc (chỉ qua interface)
┌───────────────▼─────────────────────────────────────────────┐
│  CỔNG (Ports) — các interface trừu tượng                    │
│  FundRepository · MemberRepository · TransactionRepository  │
│  AuditLogRepository · StoragePort · AuthPort · Clock · Id   │
└───────────────┬─────────────────────────────────────────────┘
                │ được hiện thực bởi
┌───────────────▼─────────────────────────────────────────────┐
│  ADAPTER                                                     │
│  ▸ in-memory  (GIAI ĐOẠN ĐẦU — dùng ngay, có seed data)     │
│  ▸ supabase   (GIAI ĐOẠN SAU — Postgres + RLS + Storage)    │
└─────────────────────────────────────────────────────────────┘
```

**Quy tắc phụ thuộc:** mũi tên phụ thuộc chỉ đi **xuống**. Tầng miền không bao giờ `import` từ tầng ứng dụng, UI hay adapter. Adapter phụ thuộc vào port, không phải ngược lại. Nhờ vậy đổi adapter không đụng tới miền.

### 2.2. Vì sao có lớp trừu tượng này (quyết định cốt lõi)

Yêu cầu của bạn là **tránh Supabase lúc đầu** để tập trung làm UI + logic. Thay vì viết cứng Supabase rồi sau khó gỡ, ta định nghĩa **port** (hợp đồng truy cập dữ liệu) và hai adapter:

- **`in-memory`** (bây giờ): lưu dữ liệu trong RAM + seed sẵn một quỹ mẫu. Giúp chạy app, làm UI, viết test ngay, không cần tài khoản/đăng ký dịch vụ nào.
- **`supabase`** (sau): hiện thực đúng port đó bằng Postgres, RLS, Storage.

Việc chuyển đổi chỉ là **đổi một biến môi trường** `DATA_BACKEND=in-memory|supabase` ở một "composition root" duy nhất. UI và use-case không đổi một dòng. Đây cũng là minh họa trực tiếp cho NFR-M (khả năng bảo trì) và là điểm kỹ thuật đáng trình bày khi nghiệm thu.

---

## 3. Công nghệ (Tech Stack)

| Lớp | Lựa chọn | Phiên bản (dự kiến) | Ghi chú |
|---|---|---|---|
| Framework | **Next.js (App Router)** | 15.x | React Server Components, Server Actions |
| Ngôn ngữ | **TypeScript** | 5.x | `strict: true` |
| UI runtime | **React** | 19.x | |
| CSS | **Tailwind CSS** | 4.x | Mobile-first, utility-first |
| Validate | **Zod** | 3.x | Schema chung cho form + API, suy ra kiểu TS |
| Kiểm thử | **Vitest** | 2.x | Unit + integration (contract test) |
| Kiểm thử E2E | **Playwright** | 1.x | Giai đoạn sau, cho luồng chính + kiểm tra rò rỉ dữ liệu |
| Nén ảnh | **browser-image-compression** | 2.x | Nén phía trình duyệt (FR-07.3) |
| Biểu đồ | CSS/SVG thuần (thanh ngang) | — | Đủ cho FR-15, không cần thư viện nặng (NFR-P5) |
| Mã QR | **qrcode** (vẽ ảnh) | 1.x | Chỉ để *vẽ* QR; chuỗi VietQR do `domain/vietqr.ts` tự sinh, không gửi số TK ra ngoài (FR-19.6). Thêm lib này là việc "Hỏi trước". |
| Backend (sau) | **Supabase** (Postgres, Auth, Storage) | — | Gói miễn phí |
| Triển khai (sau) | **Vercel** | — | Gói miễn phí |

**Nguyên tắc phụ thuộc:** thêm thư viện là việc "Hỏi trước" (xem §10). Ưu tiên nền tảng có sẵn để giữ JS tải lần đầu ≤ 250 KB (NFR-P5).

---

## 4. Cấu trúc thư mục

```
FundManager/
├── README.md                  # Giới thiệu ngắn ở gốc
├── docs/                      # Tài liệu dự án (01..04 + MVP.md)
├── spec/                      # Spec kỹ thuật rút gọn (bước sau, nếu cần tách module)
├── tasks/                     # plan.md + todo.md (Bước 5)
├── src/
│   ├── app/                   # Next.js App Router
│   │   ├── (treasurer)/       # Nhóm trang thủ quỹ — YÊU CẦU ĐĂNG NHẬP
│   │   │   ├── funds/         #   Danh sách quỹ, tạo quỹ
│   │   │   └── funds/[id]/    #   Chi tiết quỹ: ghi thu/chi, thành viên, link, nhật ký
│   │   ├── f/[token]/         # Trang xem theo token (thành viên + công khai), KHÔNG cần đăng nhập
│   │   ├── login/             # Đăng nhập (giai đoạn đầu: đăng nhập giả lập dev)
│   │   └── api/               # Route handlers khi cần (vd: tải ảnh, xuất CSV)
│   ├── domain/                # ❗ THUẦN — không import Next.js/Supabase
│   │   ├── types.ts           #   Fund, Member, Transaction, AuditLog, enums, branded id
│   │   ├── money.ts           #   Kiểu tiền (VND nguyên), cộng/trừ an toàn
│   │   ├── balance.ts         #   computeBalance(), computeTotals()
│   │   ├── payment-status.ts  #   computeMemberStatus(), summarizeFund()
│   │   ├── transaction-rules.ts  # Bất biến: không xóa, chuyển voided, điều kiện ảnh...
│   │   ├── vietqr.ts          #   Sinh chuỗi VietQR (EMVCo) + CRC-16 — HÀM THUẦN, test được
│   │   └── errors.ts          #   DomainError + mã lỗi
│   ├── ports/                 # Hợp đồng (interface) truy cập hạ tầng
│   │   ├── repositories.ts    #   *Repository + UnitOfWork
│   │   ├── storage.ts         #   StoragePort (ảnh)
│   │   └── services.ts        #   AuthPort, Clock, IdGenerator, TokenGenerator
│   ├── adapters/
│   │   ├── in-memory/         #   Adapter RAM + seed (GIAI ĐOẠN ĐẦU)
│   │   └── supabase/          #   Adapter Supabase (GIAI ĐOẠN SAU)
│   ├── application/           # Use-case: điều phối domain + ports; nơi đặt Server Actions
│   ├── lib/
│   │   ├── container.ts       #   Composition root: chọn adapter theo DATA_BACKEND
│   │   ├── format.ts          #   formatMoney, formatDate (NFR-U5)
│   │   └── slug.ts, utils.ts
│   └── components/            # Component UI tái dùng (nút, form, thẻ giao dịch, biểu đồ)
├── tests/
│   ├── domain/                # Unit test lớp miền (thuần, nhanh)
│   ├── contract/              # Contract test: mọi adapter phải pass cùng bộ test
│   └── e2e/                   # Playwright (sau)
├── supabase/
│   └── migrations/            # SQL schema + RLS + trigger (viết ở bước DB, áp dụng sau)
├── package.json, tsconfig.json, vitest.config.ts, next.config.ts, tailwind...
└── .env.example               # Mẫu biến môi trường (không commit .env thật)
```

---

## 5. Mô hình miền (Domain Model)

### 5.1. Kiểu dữ liệu cốt lõi

Ánh xạ 1-1 với §6 của Bước 3, nhưng là kiểu TypeScript thuần. Dùng **branded type** cho id để không lẫn id giữa các bảng (an toàn kiểu).

```typescript
// src/domain/types.ts
export type FundId    = string & { readonly __brand: 'FundId' };
export type MemberId  = string & { readonly __brand: 'MemberId' };
export type TxnId     = string & { readonly __brand: 'TxnId' };
export type UserId    = string & { readonly __brand: 'UserId' };

export type Vnd = number; // Số nguyên VND (xem §5.2). Không dùng số thực.

export type TxnType       = 'income' | 'expense';
export type PaymentMethod = 'transfer' | 'cash';
export type TxnStatus     = 'active' | 'voided';
export type ExpenseCategory =
  | 'food' | 'printing' | 'gift' | 'transport' | 'charity' | 'other';

export interface Fund {
  id: FundId;
  ownerId: UserId;
  name: string;                 // 1–100 ký tự
  description: string | null;   // ≤ 500
  targetPerMember: Vnd;         // ≥ 0; 0 = không đặt mức đóng
  // Thông tin nhận tiền cho VietQR (FR-19). null = chưa gắn ⇒ không hiện QR.
  bankBin: string | null;       // mã BIN Napas của ngân hàng
  bankAccountNumber: string | null;
  bankAccountName: string | null;
  transferPrefix: string | null; // tiền tố nội dung CK, vd 'QUY12A1'
  memberToken: string;          // ≥128-bit ngẫu nhiên
  publicToken: string;
  publicEnabled: boolean;       // mặc định false
  createdAt: Date;
}

export interface Member {
  id: MemberId;
  fundId: FundId;
  name: string;
  isActive: boolean;            // false = ngưng tham gia
  createdAt: Date;
}

export interface Transaction {
  id: TxnId;
  fundId: FundId;
  type: TxnType;                // không đổi sau khi tạo
  amount: Vnd;                  // > 0, ≤ 1_000_000_000
  memberId: MemberId | null;    // bắt buộc nếu income
  purpose: string | null;       // bắt buộc nếu expense
  category: ExpenseCategory | null; // bắt buộc nếu expense
  paymentMethod: PaymentMethod | null; // bắt buộc nếu income
  note: string | null;
  noReceipt: boolean;
  noReceiptReason: string | null;
  txnDate: string;              // 'YYYY-MM-DD', ≤ hôm nay
  status: TxnStatus;
  voidReason: string | null;
  voidedBy: UserId | null;
  voidedAt: Date | null;
  createdBy: UserId;            // máy chủ gán
  createdAt: Date;
  updatedAt: Date | null;
  attachments: Attachment[];    // ≤ 3
}

export interface Attachment {
  id: string;
  storagePath: string;          // đường dẫn trong kho riêng tư
  sizeBytes: number;            // ≤ 512_000
  createdAt: Date;
}

export type AuditAction = 'create' | 'update' | 'void';
export interface AuditLog {
  id: number;
  fundId: FundId;
  transactionId: TxnId;
  action: AuditAction;
  oldData: unknown | null;      // null nếu create
  newData: unknown;
  actorId: UserId;
  createdAt: Date;
}
```

### 5.2. Tiền tệ (Money)

- Lưu **số nguyên VND**. Trong Postgres là `bigint`; trong TS dùng `number`.
- **An toàn số:** giới hạn 1 giao dịch ≤ 1e9 (BR-01), quy mô ≤ 2.000 giao dịch (NFR-P4) ⇒ tổng tối đa ~2e12, còn xa `Number.MAX_SAFE_INTEGER` (~9e15). Dùng `number` an toàn trong miền; chỉ cần cẩn thận khi đọc `bigint` từ Supabase (ép về number có kiểm tra ngưỡng).
- `money.ts` cung cấp `addVnd`, `subVnd`, và guard `assertValidAmount(n)` (nguyên, >0, ≤1e9).

### 5.3. Logic nghiệp vụ thuần (trái tim của tính minh bạch)

Tất cả là **hàm thuần** trên mảng dữ liệu — không chạm DB, nên **test cực nhanh và chắc** (đáp ứng NFR-M3). Đây là nơi hiện thực BR-02, FR-11, FR-12.

```typescript
// src/domain/balance.ts
export function computeTotals(txns: Transaction[]): {
  income: Vnd; expense: Vnd; balance: Vnd;
} {
  const active = txns.filter(t => t.status === 'active');
  const income  = active.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expense = active.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  return { income, expense, balance: income - expense }; // có thể âm (thủ quỹ ứng trước)
}

// src/domain/payment-status.ts
export type MemberPaymentStatus = 'paid' | 'partial' | 'unpaid';

export function computeMemberPaid(memberId: MemberId, txns: Transaction[]): Vnd {
  return txns
    .filter(t => t.status === 'active' && t.type === 'income' && t.memberId === memberId)
    .reduce((s, t) => s + t.amount, 0);
}

export function computeMemberStatus(paid: Vnd, target: Vnd): MemberPaymentStatus | null {
  if (target <= 0) return null;        // Quỹ không đặt mức đóng ⇒ không hiện trạng thái (FR-12.3)
  if (paid >= target) return 'paid';
  if (paid > 0)       return 'partial';
  return 'unpaid';
}
```

### 5.4. Bất biến giao dịch (transaction-rules.ts)

Các hàm "cửa ngõ" cho mọi thao tác sửa/hủy, trả về giao dịch mới hoặc ném `DomainError`:

- `voidTransaction(txn, {reason, actorId, now})` → bắt buộc `reason` 5–200 ký tự; chỉ `active` mới hủy được; trả về bản `voided`. **Không có hàm xóa.**
- `editTransaction(txn, patch)` → chỉ sửa khi `active`; cấm đổi `type`; trả về bản mới + dữ liệu cũ để ghi nhật ký.
- `assertReceiptRule(input)` → chi phải có ảnh HOẶC (`noReceipt=true` kèm lý do ≥5); thu `transfer` phải có ảnh, `cash` thì không (BR-05, BR-06).
- `assertTxnDateNotFuture(date, today)` (BR-07).

---

## 6. Hợp đồng cổng (Ports) — thiết kế contract-first

Áp dụng kỹ năng *api-and-interface-design*: định nghĩa interface vào/ra rõ ràng, lỗi nhất quán, mở rộng bằng thêm field (không sửa/xóa field cũ).

### 6.1. Repository

```typescript
// src/ports/repositories.ts
export interface FundRepository {
  create(input: NewFund): Promise<Fund>;
  getById(id: FundId): Promise<Fund | null>;
  listByOwner(ownerId: UserId): Promise<Fund[]>;
  getByMemberToken(token: string): Promise<Fund | null>;
  getByPublicToken(token: string): Promise<Fund | null>; // chỉ trả khi publicEnabled
  update(id: FundId, patch: FundPatch): Promise<Fund>;
  rotateToken(id: FundId, which: 'member' | 'public'): Promise<Fund>; // FR-14.4
}

export interface MemberRepository {
  listByFund(fundId: FundId, opts?: { activeOnly?: boolean }): Promise<Member[]>;
  addMany(fundId: FundId, names: string[]): Promise<Member[]>; // dán hàng loạt (FR-04.2)
  update(id: MemberId, patch: { name?: string; isActive?: boolean }): Promise<Member>;
  remove(id: MemberId): Promise<void>; // CHỈ khi chưa có giao dịch (BR-08) — adapter kiểm tra
  hasTransactions(id: MemberId): Promise<boolean>;
}

export interface TransactionRepository {
  listByFund(fundId: FundId, q?: TxnQuery): Promise<Paginated<Transaction>>;
  getById(id: TxnId): Promise<Transaction | null>;
  // KHÔNG có delete(). Chỉ có create/update/void qua UnitOfWork bên dưới.
}

export interface AuditLogRepository {
  listByFund(fundId: FundId, page: PageParams): Promise<Paginated<AuditLog>>;
  // KHÔNG có update()/delete(): append-only (BR-04). Ghi chỉ qua UnitOfWork.
}
```

### 6.2. Unit of Work — ghi giao dịch và nhật ký trong cùng một transaction (NFR-I2)

Bất biến NFR-I2: *ghi giao dịch và ghi nhật ký cùng thành công hoặc cùng thất bại.* Ta gói chúng vào một thao tác nguyên tử ở cổng, để adapter nào cũng phải tôn trọng:

```typescript
// src/ports/repositories.ts (tiếp)
export interface FundUnitOfWork {
  // Tạo giao dịch + ghi audit 'create' nguyên tử; trả về giao dịch đã tạo
  createTransaction(input: NewTransaction, actorId: UserId): Promise<Transaction>;
  // Sửa + ghi audit 'update' (kèm old/new) nguyên tử
  updateTransaction(id: TxnId, patch: TxnPatch, actorId: UserId): Promise<Transaction>;
  // Hủy + ghi audit 'void' nguyên tử
  voidTransaction(id: TxnId, reason: string, actorId: UserId): Promise<Transaction>;
}
```

- **in-memory:** "nguyên tử" = thực thi tuần tự trong một hàm, nếu lỗi thì không đẩy gì vào store.
- **supabase:** hiện thực bằng **trigger** Postgres ghi `audit_logs` tự động trên `INSERT/UPDATE` của `transactions` (FR-10.3), đảm bảo không thao tác nào lọt qua mà thiếu nhật ký — kể cả khi ai đó gọi thẳng SQL.

### 6.3. Các cổng dịch vụ phụ

```typescript
// src/ports/services.ts
export interface Clock { now(): Date; today(): string; }          // 'YYYY-MM-DD' giờ VN
export interface IdGenerator { uuid(): string; }
export interface TokenGenerator { secureToken(): string; }        // ≥128-bit base64url (FR-14.1)
export interface AuthPort { getCurrentUser(): Promise<{ id: UserId; email: string } | null>; }

// src/ports/storage.ts
export interface StoragePort {
  // Lưu ảnh đã nén, trả storagePath (không phải URL công khai)
  put(fundId: FundId, bytes: Blob, contentType: string): Promise<{ storagePath: string; sizeBytes: number }>;
  // Trả signed URL hết hạn ≤ 1 giờ (NFR-S4) — in-memory trả object URL tạm
  signedUrl(storagePath: string, ttlSeconds?: number): Promise<string>;
}
```

### 6.4. Kiểu vào/ra & lỗi nhất quán

- **Vào/ra tách biệt:** `NewFund`/`FundPatch` (đầu vào) khác `Fund` (đầu ra, có field máy chủ gán như `createdAt`).
- **Phân trang nhất quán:** mọi danh sách trả `Paginated<T> = { data: T[]; page; pageSize; totalItems; totalPages }` (20/trang — FR-10.4, FR-13.1).
- **Lỗi nhất quán:** một kiểu `DomainError` với `code` máy đọc được + `message` tiếng Việt cho người dùng:

```typescript
// src/domain/errors.ts
export type ErrorCode =
  | 'VALIDATION'        // 422: dữ liệu sai định dạng/ràng buộc
  | 'NOT_FOUND'         // 404
  | 'FORBIDDEN'         // 403: không đủ quyền (vd thủ quỹ A đụng quỹ của B)
  | 'LINK_REVOKED'      // token sai/đã thu hồi/đang tắt (FR-14.5)
  | 'CONFLICT'          // 409: trùng, xung đột
  | 'RULE_VIOLATION';   // vi phạm quy tắc nghiệp vụ (xóa giao dịch, sửa nhật ký...)

export class DomainError extends Error {
  constructor(public code: ErrorCode, message: string, public details?: unknown) {
    super(message);
  }
}
```

Tầng ứng dụng ánh xạ `code → HTTP status` thống nhất (422/404/403/409...). UI đọc `message` để hiển thị (NFR-U8).

---

## 7. Tầng ứng dụng & giao diện API

### 7.1. Hai con đường truy cập

| Con đường | Ai dùng | Cơ chế | Cưỡng chế quyền |
|---|---|---|---|
| **Thủ quỹ** | TQ đã đăng nhập | **Server Actions** (mutations) + Server Components (đọc) | `AuthPort.getCurrentUser()` + kiểm tra `fund.ownerId === user.id` ở mọi use-case |
| **Xem theo token** | TV, KX | Route `/f/[token]` → **use-case đọc theo token** | Server tra token → trả **đúng phần dữ liệu được phép**; field bị ẩn **không bao giờ rời máy chủ** |

**Điểm mấu chốt an ninh (AT-26):** với link công khai, việc ẩn tên người đóng/ảnh chuyển khoản/trạng thái đóng tiền **không phải ẩn ở CSS** mà là *không đưa field đó vào response*. Ta có hai hàm "chiếu" (projection) riêng:

```typescript
// src/application/views.ts
toMemberView(fund, txns, members): FullFundView     // đầy đủ
toPublicView(fund, txns): PublicFundView            // ĐÃ loại bỏ: tên TV, ảnh thu, note thu, danh sách đóng tiền
```

### 7.2. Quy ước Server Action

```typescript
// Mẫu: validate ở biên → gọi use-case → trả kết quả có kiểu
'use server';
export async function recordExpense(fundId: string, formData: FormData): Promise<ActionResult> {
  const user = await requireTreasurer(fundId);          // ném FORBIDDEN nếu không phải chủ quỹ
  const input = ExpenseSchema.parse(fromFormData(formData)); // Zod validate (422 nếu sai)
  const txn = await uow.createTransaction(toNewTransaction(input, user.id), user.id);
  revalidatePath(`/funds/${fundId}`);
  return { ok: true, id: txn.id };
}
```

- **Validate tại biên** bằng Zod; schema Zod dùng chung cho cả form phía client (phản hồi lỗi sớm) và server (nguồn chân lý).
- **Thời điểm/người tạo do máy chủ gán** (BR-10, NFR-I4) — không nhận từ client.
- **Idempotency:** các action ghi dữ liệu là thao tác do người dùng chủ động bấm, rủi ro double-submit thấp; ta chặn ở UI (disable nút khi đang gửi). Không cần idempotency-key cho MVP, nhưng *ghi chú lại* để nếu sau này có webhook khớp giao dịch ngân hàng thì endpoint đó phải idempotent.

### 7.3. API Route Handlers (chỉ khi cần)

- `GET /f/[token]` và các trang xem: ưu tiên Server Component đọc trực tiếp use-case (không cần REST).
- `GET /api/attachments/[id]`: trả **redirect tới signed URL** (NFR-S4), có kiểm tra quyền theo ngữ cảnh token.
- `GET /api/funds/[id]/export.csv`: xuất CSV UTF-8 có BOM (FR-17) — Could.
- Nếu có REST, theo chuẩn *api-and-interface-design*: danh từ số nhiều, lỗi một định dạng, có phân trang.

---

## 8. Mô hình an ninh theo giai đoạn

| Khía cạnh | Giai đoạn đầu (in-memory) | Giai đoạn Supabase |
|---|---|---|
| Đăng nhập TQ | **Đăng nhập giả lập dev** (chọn/nhập 1 user giả, đặt cookie phiên) | **Chỉ Google OAuth** (FR-01) — app không gửi email nào |
| Cưỡng chế quyền | **Ở tầng ứng dụng** (use-case kiểm `ownerId`, chiếu dữ liệu theo token) | Giữ nguyên tầng ứng dụng **+ thêm RLS** (phòng thủ nhiều lớp, NFR-S2) |
| Không xóa GD / nhật ký bất biến | Port không có hàm xóa; audit chỉ-thêm | Thêm trigger + thiếu vắng policy DELETE/UPDATE ở DB (NFR-I3) |
| Ảnh | Object URL tạm trong RAM | Bucket riêng tư + signed URL ≤1h (NFR-S4) |
| Token link | Sinh ≥128-bit, tra server-side | Như cũ + rate-limit (NFR-S7) |

**Nguyên tắc:** mọi cưỡng chế quyền **bắt đầu ở tầng ứng dụng ngay từ đầu**. Khi lên Supabase, RLS là *lớp phòng thủ thêm*, không phải chỗ bắt đầu — nên không có giai đoạn nào "hở" rồi mới vá. Đây là cách áp dụng kỹ năng *security-and-hardening* sớm thay vì để cuối.

---

## 9. Chiến lược kiểm thử

Áp dụng *test-driven-development* cho phần logic, và một bộ **contract test** dùng chung cho mọi adapter.

| Mức | Công cụ | Phạm vi | Khi nào |
|---|---|---|---|
| **Unit (miền)** | Vitest | `balance`, `payment-status`, `transaction-rules`, `money`, `format` — hàm thuần | Viết **test trước** (red-green-refactor) cho từng quy tắc |
| **Contract (adapter)** | Vitest | Một bộ test chạy với **cả** in-memory **và** (sau này) supabase; khẳng định cùng hành vi: không xóa được GD, audit đúng 3 bản ghi create/update/void (AT-21), rotate token vô hiệu token cũ (AT-27)... | Mỗi khi thêm/sửa adapter |
| **Component/UI** | Vitest + Testing Library | Form thu/chi validate đúng, thẻ giao dịch hiện nhãn đúng | Khi làm UI |
| **E2E** | Playwright | Luồng chính (thiết lập quỹ, ghi chi <30s), và **kiểm tra rò rỉ**: response link công khai không chứa field ẩn (AT-26) | Giai đoạn hoàn thiện |

**Bắt buộc có test tự động cho (NFR-M3):** tính số dư (AT-22), trạng thái đóng tiền (AT-23), không xóa được giao dịch (AT-19), nhật ký chỉ-thêm (AT-20, AT-21). Đây là các test "không được phép đỏ".

**Lệnh:**
```
Cài:   npm install
Dev:   npm run dev
Build: npm run build
Test:  npm test            # vitest chạy một lần
Watch: npm run test:watch
Lint:  npm run lint
Type:  npm run typecheck   # tsc --noEmit
```

---

## 10. Ranh giới làm việc (Boundaries)

**Luôn làm (Always):**
- Giữ tầng `domain/` thuần: không `import` Next.js, Supabase, hay adapter.
- Validate đầu vào ở biên (server action / route) bằng Zod trước khi vào use-case.
- Tiền là số nguyên VND; thời điểm/người tạo do máy chủ gán.
- Mỗi thay đổi giao dịch đi kèm một bản ghi nhật ký (qua UnitOfWork).
- Chạy `npm test` + `npm run typecheck` trước khi commit; mỗi bước xong thì commit.

**Hỏi trước (Ask first):**
- Thêm thư viện mới (ảnh hưởng NFR-P5 / bundle size).
- Thay đổi **hợp đồng port** (vì đó là xương sống của hệ thống).
- Thay đổi schema dữ liệu / migration.
- Thêm/đổi cấu hình CI, biến môi trường.

**Không bao giờ (Never):**
- Thêm đường xóa giao dịch hay sửa/xóa nhật ký ở bất kỳ tầng nào.
- Gửi field bị ẩn (tên TV, ảnh thu...) xuống client ở đường link công khai.
- Commit secret / service role key; để lộ key ra client.
- Lưu tiền bằng số thực; tin dữ liệu client cho `createdBy`/`createdAt`.

---

## 11. Lộ trình các bước tiếp theo & ánh xạ kỹ năng

Bạn muốn **áp dụng mọi kỹ năng** — bảng này gắn mỗi bước sắp tới với kỹ năng dẫn đường. Mỗi bước là một điểm dừng để bạn duyệt.

| Bước | Việc | Kỹ năng áp dụng chính |
|---|---|---|
| **4 (này)** | Tài liệu thiết kế hệ thống | `spec-driven-development`, `api-and-interface-design` |
| 5 | Chia task có thứ tự + ước lượng (`tasks/plan.md`, `tasks/todo.md`) | `planning-and-task-breakdown` |
| 6 | Scaffold Next.js + Tailwind + Vitest; dựng `container`, port, adapter in-memory rỗng | `incremental-implementation`, `constraint-driven-development` |
| 7 | Lớp miền + test trước: money, balance, payment-status, rules | `test-driven-development` |
| 8 | Adapter in-memory + contract test + seed data | `test-driven-development`, `api-and-interface-design` |
| 9 | UI thủ quỹ: tạo quỹ, thành viên, ghi thu/chi (mobile-first, a11y) | `frontend-ui-engineering`, `accessibility-engineering` |
| **9b** | **VietQR (FR-19): `domain/vietqr.ts` test-first + gắn tài khoản NH + UI hiển thị QR cho thành viên** — làm sớm theo yêu cầu | `test-driven-development`, `frontend-ui-engineering`, `security-and-hardening` |
| 10 | Trang xem theo token (thành viên/công khai), tổng quan, nhật ký | `frontend-ui-engineering`, `security-and-hardening` |
| 11 | Hủy/sửa giao dịch + nhật ký, biểu đồ, lọc/tìm | `incremental-implementation`, `debugging-and-error-recovery` |
| 12 | Viết migration Supabase (schema + RLS + trigger) | `security-and-hardening`, `api-and-interface-design` |
| 13 | Adapter Supabase (pass đúng contract test) + đổi `DATA_BACKEND` | `deprecation-and-migration`, `test-driven-development` |
| 14 | E2E, đo hiệu năng (Lighthouse), rà a11y, kiểm rò rỉ link công khai | `performance-optimization`, `observability-and-instrumentation` |
| 15 | Triển khai Vercel, checklist phát hành, README | `shipping-and-launch`, `ci-cd-and-automation`, `documentation-and-adrs` |

Xuyên suốt: `git-workflow-and-versioning` (commit sạch mỗi bước), `code-review-and-quality` + `code-simplification` (trước khi gộp), `context-engineering` (nạp đúng tài liệu/mã mỗi bước).

---

## 12. Tiêu chí hoàn thành bước thiết kế (Success Criteria)

- [ ] Kiến trúc phân tầng + ports/adapters đủ rõ để bắt đầu lập trình mà không phải đoán.
- [ ] Mọi bảng dữ liệu (Bước 3 §6) đều có kiểu miền tương ứng.
- [ ] Mọi quy tắc nghiệp vụ (BR-01→BR-10) có chỗ cưỡng chế rõ ràng trong thiết kế.
- [ ] Hợp đồng port đủ để viết adapter in-memory và (sau) Supabase mà không đổi UI.
- [ ] Chiến lược test phủ các bất biến bắt buộc (NFR-M3, AT-19→AT-23).
- [ ] Ranh giới Always/Ask/Never rõ ràng.

---

## 13. Ngoài phạm vi bước này (Deferred)

- Chi tiết SQL migration (schema cụ thể, câu lệnh RLS, trigger) → Bước 12.
- Thiết kế giao diện pixel (wireframe/màu/typography chi tiết) → đưa vào bước UI (9–10); tài liệu này chỉ chốt mobile-first + a11y + mã màu +/− theo NFR-U9.
- **Tự động khớp** giao dịch ngân hàng (US-22/FR-20), đồng thủ quỹ → sau MVP. (VietQR — US-21/FR-19 — đã đưa vào MVP.)

## 14. Câu hỏi mở (Open Questions)

1. **Đăng nhập giả lập giai đoạn đầu:** chấp nhận một màn hình "chọn user dev" đơn giản (không mật khẩu) để làm UI trước, đúng không? (Sẽ thay bằng **Google OAuth** ở Bước 13 — app không gửi email nào.)
2. **Ngôn ngữ trong mã nguồn:** định danh code bằng tiếng Anh, chuỗi hiển thị + commit message + tài liệu bằng tiếng Việt — ổn chứ?
3. **Biểu đồ:** tự vẽ thanh ngang bằng SVG/CSS (nhẹ, không thêm lib) thay vì dùng thư viện chart — đồng ý không?
