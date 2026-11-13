import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import { puedeVerRuta } from "@/lib/permisos";
import type { RolApp } from "@/lib/constants";

export default withAuth(
  function middleware(req) {
    const rol = req.nextauth.token?.rol as RolApp | undefined;
    if (!puedeVerRuta(rol, req.nextUrl.pathname)) {
      const url = req.nextUrl.clone();
      url.pathname = "/dashboard";
      url.searchParams.set("denegado", req.nextUrl.pathname);
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  },
  {
    pages: { signIn: "/login" },
    callbacks: { authorized: ({ token }) => !!token },
  },
);

export const config = {
  matcher: ["/((?!login|api/auth|api/health|_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
