import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/constants";

/**
 * Chặn truy cập nhóm trang thủ quỹ khi chưa đăng nhập (AT-01).
 * Chỉ kiểm tra có cookie phiên hay không; việc xác thực user hợp lệ do
 * layout (treasurer) đảm nhiệm (getCurrentUser). Chưa có phiên → về /login.
 */
export function middleware(request: NextRequest) {
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);
  if (hasSession) return NextResponse.next();

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  // Nhóm (treasurer) hiện có /funds/* ; thêm route mới thì bổ sung matcher.
  matcher: ["/funds/:path*"],
};
