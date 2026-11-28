"use client";

import { useActionState, useRef, useState } from "react";
import { recordExpenseAction } from "./actions";
import type { ExpenseState } from "./expense-state";
import { compressImage } from "@/lib/compress-image";
import { EXPENSE_CATEGORIES } from "@/lib/labels";
import { formatMoney } from "@/lib/format";

const initial: ExpenseState = { status: "idle" };

const fieldClass =
  "w-full rounded-lg border border-foreground/15 bg-transparent px-3 py-2 focus-visible:outline-2 focus-visible:outline-offset-2";

export function ExpenseForm({
  fundId,
  today,
  balance,
  defaultCategory,
}: {
  fundId: string;
  today: string;
  balance: number;
  defaultCategory: string | null;
}) {
  const [state, action, pending] = useActionState(recordExpenseAction, initial);
  const [noReceipt, setNoReceipt] = useState(false);
  const [fileInfo, setFileInfo] = useState("");
  const [compressing, setCompressing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) {
      setFileInfo("");
      return;
    }
    setCompressing(true);
    try {
      const compressed = await compressImage(f);
      const dt = new DataTransfer();
      dt.items.add(compressed);
      if (fileRef.current) fileRef.current.files = dt.files;
      setFileInfo(`${compressed.name} · ${Math.round(compressed.size / 1024)} KB`);
    } finally {
      setCompressing(false);
    }
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="fundId" value={fundId} />
      <p className="text-sm text-foreground/50">
        Số dư hiện tại: {formatMoney(balance)}
      </p>

      <div className="space-y-1">
        <label htmlFor="e-amount" className="block text-sm font-medium">
          Số tiền (đồng) <span className="text-red-500">*</span>
        </label>
        <input
          id="e-amount"
          name="amount"
          type="number"
          min={1}
          step={1}
          inputMode="numeric"
          required
          className={fieldClass}
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="e-purpose" className="block text-sm font-medium">
          Mục đích <span className="text-red-500">*</span>
        </label>
        <input
          id="e-purpose"
          name="purpose"
          required
          maxLength={200}
          className={fieldClass}
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="e-category" className="block text-sm font-medium">
          Danh mục <span className="text-red-500">*</span>
        </label>
        <select
          id="e-category"
          name="category"
          defaultValue={defaultCategory ?? "food"}
          className={fieldClass}
        >
          {EXPENSE_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <label htmlFor="e-method" className="block text-sm font-medium">
          Hình thức <span className="text-foreground/40">(tùy chọn)</span>
        </label>
        <select
          id="e-method"
          name="paymentMethod"
          defaultValue=""
          className={fieldClass}
        >
          <option value="">— Không rõ —</option>
          <option value="cash">Tiền mặt</option>
          <option value="transfer">Chuyển khoản</option>
        </select>
      </div>

      <div className="space-y-1">
        <label htmlFor="e-date" className="block text-sm font-medium">
          Ngày
        </label>
        <input
          id="e-date"
          name="txnDate"
          type="date"
          defaultValue={today}
          max={today}
          required
          className={fieldClass}
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="e-receipt" className="block text-sm font-medium">
          Ảnh hóa đơn{" "}
          {noReceipt ? (
            <span className="text-foreground/40">(không bắt buộc)</span>
          ) : (
            <span className="text-red-500">(bắt buộc)</span>
          )}
        </label>
        <input
          ref={fileRef}
          id="e-receipt"
          name="receipt"
          type="file"
          accept="image/*"
          required={!noReceipt}
          onChange={onFileChange}
          className="block w-full text-sm"
        />
        {compressing && (
          <p className="text-sm text-foreground/50">Đang nén ảnh…</p>
        )}
        {fileInfo && !compressing && (
          <p className="text-sm text-foreground/50">Đã nén: {fileInfo}</p>
        )}
      </div>

      <div className="space-y-2 rounded-lg border border-foreground/10 p-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="noReceipt"
            checked={noReceipt}
            onChange={(e) => setNoReceipt(e.target.checked)}
          />
          Không có hóa đơn
        </label>
        {noReceipt && (
          <div className="space-y-1">
            <label htmlFor="e-reason" className="block text-sm font-medium">
              Lý do không có hóa đơn{" "}
              <span className="text-red-500">(≥ 5 ký tự)</span>
            </label>
            <input
              id="e-reason"
              name="noReceiptReason"
              required
              minLength={5}
              maxLength={200}
              className={fieldClass}
            />
          </div>
        )}
      </div>

      <div className="space-y-1">
        <label htmlFor="e-note" className="block text-sm font-medium">
          Ghi chú <span className="text-foreground/40">(tùy chọn)</span>
        </label>
        <input id="e-note" name="note" maxLength={500} className={fieldClass} />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="confirmOverspend" />
        Xác nhận chi vượt số dư (nếu có)
      </label>

      <div aria-live="polite" className="space-y-2">
        <button
          type="submit"
          disabled={pending || compressing}
          className="rounded-lg bg-foreground px-4 py-2 font-medium text-background transition disabled:opacity-50"
        >
          {pending ? "Đang lưu…" : "Ghi khoản chi"}
        </button>
        {state.status === "error" && (
          <p role="alert" className="text-sm text-red-600">
            {state.message}
          </p>
        )}
        {state.status === "success" && (
          <p role="status" className="text-sm text-green-600">
            Đã ghi khoản chi.
          </p>
        )}
      </div>
    </form>
  );
}
