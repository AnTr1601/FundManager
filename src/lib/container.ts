import type { AppPorts } from "@/ports";
import { createInMemoryPorts } from "@/adapters/in-memory/store";
import { seedDemo } from "@/adapters/in-memory/seed";

export type DataBackend = "in-memory" | "supabase";

/** Đọc backend từ biến môi trường `DATA_BACKEND` (mặc định in-memory). */
export function resolveBackend(): DataBackend {
  const v = (process.env.DATA_BACKEND ?? "in-memory").trim().toLowerCase();
  if (v === "" || v === "in-memory" || v === "inmemory" || v === "memory") {
    return "in-memory";
  }
  if (v === "supabase") return "supabase";
  throw new Error(
    `DATA_BACKEND không hợp lệ: "${v}". Dùng "in-memory" hoặc "supabase".`,
  );
}

function build(): AppPorts {
  const backend = resolveBackend();
  if (backend === "in-memory") return createInMemoryPorts();
  // Adapter Supabase sẽ được hiện thực ở T27 (phải pass cùng bộ contract test).
  throw new Error('Adapter "supabase" chưa được hiện thực (xem T27).');
}

// Giữ singleton qua global để sống sót khi Next.js hot-reload ở chế độ dev
// (nếu không, dữ liệu in-memory sẽ bị reset mỗi lần biên dịch lại).
const globalRef = globalThis as typeof globalThis & {
  __fundPorts?: AppPorts;
  __fundPortsReady?: Promise<AppPorts>;
};

/** Lấy ports (singleton). KHÔNG tự seed — dùng khi cần truy cập trực tiếp. */
export function getPorts(): AppPorts {
  if (!globalRef.__fundPorts) globalRef.__fundPorts = build();
  return globalRef.__fundPorts;
}

/**
 * Lấy ports đã seed xong (chỉ seed MỘT lần cho mỗi tiến trình).
 * Chỉ seed với in-memory và khi không tắt bằng `SEED_DEMO=false`.
 */
export function getPortsReady(): Promise<AppPorts> {
  if (!globalRef.__fundPortsReady) {
    const ports = getPorts();
    const shouldSeed =
      resolveBackend() === "in-memory" && process.env.SEED_DEMO !== "false";
    globalRef.__fundPortsReady = shouldSeed
      ? seedDemo(ports).then(() => ports)
      : Promise.resolve(ports);
  }
  return globalRef.__fundPortsReady;
}
