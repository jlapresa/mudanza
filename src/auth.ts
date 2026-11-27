import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import type { Rol } from "@prisma/client";
import { authConfig } from "./auth.config";
import { db } from "./lib/db";
import { emailPermitido, entradaInicial, huella, registrarConEnlaceEquipo, usuarioPorToken } from "./lib/acceso";

declare module "next-auth" {
  interface Session {
    user: { id: string; rol: Rol; email: string; name: string } & DefaultSession["user"];
  }
}

export const devLogin = process.env.AUTH_DEV_LOGIN === "1" && process.env.VERCEL_ENV !== "production";

const providers = [
  // Enlace personal (o enlace inicial del responsable).
  Credentials({
    id: "enlace",
    credentials: { token: {} },
    async authorize(c) {
      const token = String(c?.token ?? "");
      const u = (await usuarioPorToken(token)) ?? (await entradaInicial(token));
      if (!u) return null;
      await db.usuario.update({ where: { id: u.id }, data: { ultimoAcceso: new Date() } });
      return { id: u.id, email: u.email, name: u.nombre };
    },
  }),
  // Registro con el enlace del equipo.
  Credentials({
    id: "equipo",
    credentials: { enlace: {}, email: {}, nombre: {} },
    async authorize(c) {
      const r = await registrarConEnlaceEquipo(String(c?.enlace ?? ""), String(c?.email ?? ""), String(c?.nombre ?? ""));
      if (typeof r === "string") return null;
      await db.usuario.update({ where: { id: r.id }, data: { ultimoAcceso: new Date() } });
      return { id: r.id, email: r.email, name: r.nombre };
    },
  }),
];

if (devLogin)
  providers.push(
    Credentials({
      id: "prueba",
      credentials: { email: {}, nombre: {}, rol: {} },
      async authorize(c) {
        const email = String(c?.email ?? "").trim().toLowerCase();
        if (!emailPermitido(email)) return null;
        const rol = (["responsable", "colaborador", "equipo"].includes(String(c?.rol)) ? c!.rol : "equipo") as Rol;
        const nombre = String(c?.nombre || email.split("@")[0]);
        const u = await db.usuario.upsert({ where: { email }, create: { email, nombre, rol }, update: { rol, nombre } });
        return { id: u.id, email: u.email, name: u.nombre };
      },
    }),
  );

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers,
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user }) {
      return emailPermitido(user.email);
    },
    async jwt({ token, user }) {
      if (user?.id) {
        token.uid = user.id;
        const u = await db.usuario.findUnique({ where: { id: user.id } });
        token.h = huella(u?.tokenAcceso);
      }
      if (token.uid) {
        const u = await db.usuario.findUnique({ where: { id: token.uid as string } });
        // Si la persona ya no existe o su enlace ha cambiado, la sesión deja de valer.
        if (!u || (token.h ?? "") !== huella(u.tokenAcceso)) return null;
        token.rol = u.rol;
        token.name = u.nombre;
        token.email = u.email;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.uid as string;
      session.user.rol = token.rol as Rol;
      session.user.name = token.name as string;
      session.user.email = token.email as string;
      return session;
    },
  },
});
