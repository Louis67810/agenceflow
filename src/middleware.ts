import { type NextRequest, NextResponse } from "next/server";

// Middleware minimal : laisse passer toutes les requêtes.
// La protection des routes est gérée côté client par AuthGuard.
export function middleware(request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
