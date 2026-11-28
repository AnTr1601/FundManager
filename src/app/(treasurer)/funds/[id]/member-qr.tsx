"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { formatMoney } from "@/lib/format";

interface Item {
  id: string;
  name: string;
  amount: number;
  content: string;
  payload: string;
}

export function MemberQR({ items }: { items: Item[] }) {
  const [selId, setSelId] = useState(items[0]?.id ?? "");
  const [copied, setCopied] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const current = items.find((i) => i.id === selId) ?? items[0];
  const payload = current?.payload;

  useEffect(() => {
    if (payload && canvasRef.current) {
      void QRCode.toCanvas(canvasRef.current, payload, {
        width: 232,
        margin: 1,
      });
    }
  }, [payload]);

  if (items.length === 0) {
    return (
      <p className="text-foreground/60">
        Chưa có thành viên đang tham gia để tạo mã QR.
      </p>
    );
  }

  function download() {
    const url = canvasRef.current?.toDataURL("image/png");
    if (!url || !current) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = `vietqr-${current.name}.png`;
    a.click();
  }

  async function copyContent() {
    if (!current) return;
    await navigator.clipboard.writeText(current.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <label htmlFor="qr-member" className="block text-sm font-medium">
          Chọn thành viên
        </label>
        <select
          id="qr-member"
          value={selId}
          onChange={(e) => {
            setSelId(e.target.value);
            setCopied(false);
          }}
          className="w-full rounded-lg border border-foreground/15 bg-transparent px-3 py-2 focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          {items.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
              {i.amount > 0 ? ` — ${formatMoney(i.amount)}` : ""}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap items-start gap-4">
        <canvas
          ref={canvasRef}
          className="rounded-lg bg-white p-2"
          aria-label={`Mã QR đóng tiền cho ${current?.name ?? ""}`}
        />
        <div className="space-y-2 text-sm">
          <p>
            Số tiền:{" "}
            <span className="font-semibold">
              {current && current.amount > 0
                ? formatMoney(current.amount)
                : "Người đóng tự nhập"}
            </span>
          </p>
          <p>
            Nội dung:{" "}
            <span className="font-mono font-medium">{current?.content}</span>
          </p>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={download}
              className="rounded-md border border-foreground/15 px-3 py-1 hover:bg-foreground/5"
            >
              Lưu ảnh QR
            </button>
            <button
              type="button"
              onClick={copyContent}
              className="rounded-md border border-foreground/15 px-3 py-1 hover:bg-foreground/5"
            >
              {copied ? "Đã sao chép" : "Sao chép nội dung"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
