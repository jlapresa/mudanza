import type { NextAuthConfig } from "next-auth";

// Configuración sin base de datos, válida para el middleware.
export const authConfig = {
  pages: { signIn: "/entrar" },
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 30 },
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const p = request.nextUrl.pathname;
      if (p.startsWith("/entrar") || p.startsWith("/api/auth") || p.startsWith("/api/cron")) return true;
      return !!auth?.user;
    },
  },
} satisfies NextAuthConfig;
