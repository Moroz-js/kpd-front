import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

/**
 * Маршруты по ролям (см. TZ Приложение B):
 *   /admin/...        — только admin
 *   /responsible/...  — только responsible
 *   /me/...           — только executor
 *   /projects/[id]    — admin или назначенный responsible (общий дашборд проекта)
 *   /login            — публичный
 */
export default auth((req) => {
  const { pathname } = req.nextUrl;
  const user = req.auth?.user as Record<string, unknown> | undefined;
  const role = user?.role as string | undefined;
  const isPm =
    role === "responsible" ||
    (role === "executor" &&
      user?.isResponsible === true &&
      user?.responsibleActive !== false);

  // Корень / login
  if (pathname === "/login" || pathname === "/") {
    if (role) {
      const redirectPath =
        role === "admin"
          ? "/admin/cashflow"
          : isPm
          ? "/responsible/projects"
          : "/me";
      return NextResponse.redirect(new URL(redirectPath, req.url));
    }
    return NextResponse.next();
  }

  if (!role) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (pathname.startsWith("/admin") && role !== "admin") {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (pathname.startsWith("/responsible") && !isPm) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (pathname.startsWith("/me") && role !== "executor") {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Поддержка старого /executor/* (временно — пока страницы не переехали на /me/*)
  if (pathname.startsWith("/executor") && role !== "executor") {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
