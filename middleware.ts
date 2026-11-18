import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

const PUBLIC = ["/login", "/registrieren"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const loggedIn = Boolean(await verifySession(req.cookies.get(SESSION_COOKIE)?.value));
  const isPublic = PUBLIC.some((p) => pathname.startsWith(p));

  if (!loggedIn && !isPublic) return NextResponse.redirect(new URL("/login", req.url));
  if (loggedIn && (isPublic || pathname === "/")) return NextResponse.redirect(new URL("/dashboard", req.url));
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|svg|ico|webmanifest)$).*)"],
};
