// Next.js middleware entry point — delegates to proxy.ts
export { proxy as middleware } from "./proxy";

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.svg|manifest\\.webmanifest|manifest\\.json|icons/).*)"],
};
