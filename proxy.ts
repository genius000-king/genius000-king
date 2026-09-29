import { NextResponse, type NextRequest } from "next/server";
import { checkBasicAuth, isPublicPath } from "@/lib/auth";

/**
 * First gate for the whole dashboard (HTTP Basic, fail closed).
 * This is not the only line of defence: route handlers and server actions that
 * touch data must verify the caller again close to the data.
 */
export function proxy(request: NextRequest) {
  if (isPublicPath(request.nextUrl.pathname)) return NextResponse.next();

  const { ADMIN_USER, ADMIN_PASSWORD } = process.env;

  if (!ADMIN_PASSWORD) {
    return new NextResponse("Not configured: set ADMIN_PASSWORD.", { status: 503 });
  }

  if (checkBasicAuth(request.headers.get("authorization"), ADMIN_USER, ADMIN_PASSWORD)) {
    return NextResponse.next();
  }

  return new NextResponse("Authentication required.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Hub", charset="UTF-8"' },
  });
}

export const config = {
  // Everything except Next's static assets and the public app icon.
  matcher: ["/((?!_next/static|_next/image|icon\\.svg).*)"],
};
