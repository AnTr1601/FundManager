"use client";

import { useActionState, useRef, useState } from "react";
import { recordIncomeAction } from "./actions";
import type { IncomeState } from "./income-state";
import { compressImage } from "@/lib/compress-image";
import { formatMoney } from "@/lib/format";

interface MemberOption {
  id: string;
  name: string;
  remaining: number;
}

const initial: IncomeState = { status: "idle" };

const fieldClass =
  "w-full rounded-lg border border-foreground/15 bg-transparent px-3 py-2 focus-visible:outline-2 focus-visible:outline-offset-2";

export function IncomeForm({
  fundId,
  members,
  today,
}: {
  fundId: string;
  members: MemberOption[];
  today: string;
}) {
  const [state, action, pending] = useActionState(recordIncomeAction, initial);
  const [method, setMethod] = useState<"transfer" | "cash">("transfer");
  const [fileInfo, setFileInfo] = useState("");
  const [compressing, setCompressing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);

  // Các input không kiểm soát: React 19 tự reset form sau khi action thành công.

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

  function onSelectMember(e: React.ChangeEvent<HTMLSelectElement>) {
    const opt = members.find((m) => m.id === e.target.value);
    if (opt && opt.remaining > 0 && amountRef.current) {
      amountRef.current.value = String(opt.remaining);
    }
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="fundId" value={fundId} />

      <div className="space-y-1">
        <label htmlFor="memberId" className="block text-sm font-medium">
          Thành viên đóng tiền <span className="text-red-500">*</span>
        </label>
        <select
          id="memberId"
          name="memberId"
          required
          defaultValue=""
          onChange={onSelectMember}
          className={fieldClass}
        >
          <option value="" disabled>
            — Chọn thành viên —
          </option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
              {m.remaining > 0 ? ` — còn thiếu ${formatMoney(m.remaining)}` : ""}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <label htmlFor="amount" className="block text-sm font-medium">
          Số tiền (đồng) <span className="text-red-500">*</span>
        </label>
        <input
          ref={amountRef}
          id="amount"
          name="amount"
          type="number"
          min={1}
          step={1}
          inputMode="numeric"
          required
          className={fieldClass}
        />
      </div>

      <fieldset className="space-y-1">
        <legend className="text-sm font-medium">Hình thức</legend>
        <div className="flex gap-4">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="paymentMethod"
              value="transfer"
              checked={method === "transfer"}
              onChange={() => setMethod("transfer")}
            />
            Chuyển khoản
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="paymentMethod"
              value="cash"
              checked={method === "cash"}
              onChange={() => setMethod("cash")}
            />
            Tiền mặt
          </label>
        </div>
      </fieldset>

      <div className="space-y-1">
        <label htmlFor="txnDate" className="block text-sm font-medium">
          Ngày
        </label>
        <input
          id="txnDate"
          name="txnDate"
          type="date"
          defaultValue={today}
          max={today}
          required
          className={fieldClass}
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="receipt" className="block text-sm font-medium">
          Ảnh chứng từ{" "}
          {method === "transfer" ? (
            <span className="text-red-500">(bắt buộc với chuyển khoản)</span>
          ) : (
            <span className="text-foreground/40">(tùy chọn)</span>
          )}
        </label>
        <input
          ref={fileRef}
          id="receipt"
          name="receipt"
          type="file"
          accept="image/*"
          required={method === "transfer"}
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

      <div className="space-y-1">
        <label htmlFor="note" className="block text-sm font-medium">
          Ghi chú <span className="text-foreground/40">(tùy chọn)</span>
        </label>
        <input id="note" name="note" maxLength={500} className={fieldClass} />
      </div>

      <div aria-live="polite" className="space-y-2">
        <button
          type="submit"
          disabled={pending || compressing}
          className="rounded-lg bg-foreground px-4 py-2 font-medium text-background transition disabled:opacity-50"
        >
          {pending ? "Đang lưu…" : "Ghi khoản thu"}
        </button>
        {state.status === "error" && (
          <p role="alert" className="text-sm text-red-600">
            {state.message}
          </p>
        )}
        {state.status === "success" && (
          <p role="status" className="text-sm text-green-600">
            Đã ghi khoản thu.
          </p>
        )}
      </div>
    </form>
  );
}
