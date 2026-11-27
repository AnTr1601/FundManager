import { createInMemoryPorts } from "@/adapters/in-memory/store";
import { runPortsContract } from "./ports-contract";

// Chạy bộ hợp đồng với adapter in-memory sạch (không seed) cho từng kịch bản.
// Khi có adapter Supabase (T27), tạo thêm một file gọi runPortsContract tương tự.
runPortsContract("in-memory", () => createInMemoryPorts());
