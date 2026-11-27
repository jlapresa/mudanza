import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import type { Rol } from "@prisma/client";
import { authConfig } from "./auth.config";
import { db } from "./lib/db";
import { comprobarCodigo, emailPermitido } from "./lib/acceso";

declare module "next-auth" {
  interface Session {
    user: { id: string; rol: Rol; email: string; name: string } & DefaultSession["user"];
  }
}

const responsables = (process.env.RESPONSABLES ?? "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

export const devLogin = process.env.AUTH_DEV_LOGIN === "1" && process.env.VERCEL_ENV !== "production";

const nombreDesdeEmail = (email: string) =>
  email.split("@")[0].split(/[._-]+/).filter(Boolean).map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(" ");

/** Crea la cuenta la primera vez que alguien entra con su correo (registro) y devuelve el usuario. */
async function asegurarUsuario(emailBruto: string, nombre?: string, rolForzado?: Rol) {
  const email = emailBruto.toLowerCase();
  const limpio = nombre?.trim().slice(0, 80);
  const existente = await db.usuario.findUnique({ where: { email } });
  if (existente) {
    const datos: { nombre?: string; rol?: Rol } = {};
    if (limpio && limpio !== existente.nombre) datos.nombre = limpio;
    if (rolForzado && rolForzado !== existente.rol) datos.rol = rolForzado;
    return Object.keys(datos).length ? db.usuario.update({ where: { email }, data: datos }) : existente;
  }
  return db.usuario.create({
    data: {
      email,
      nombre: limpio || nombreDesdeEmail(email),
      rol: rolForzado ?? (responsables.includes(email) ? "responsable" : "equipo"),
    },
  });
}

const providers = [
  Credentials({
    id: "codigo",
    name: "Código por correo",
    credentials: { email: {}, codigo: {}, nombre: {} },
    async authorize(c) {
      const email = String(c?.email ?? "");
      if (!(await comprobarCodigo(email, String(c?.codigo ?? "")))) return null;
      const u = await asegurarUsuario(email, c?.nombre ? String(c.nombre) : undefined);
      return { id: u.id, email: u.email, name: u.nombre };
    },
  }),
];
if (devLogin)
  providers.push(
    Credentials({
      id: "prueba",
      name: "Acceso de prueba",
      credentials: { email: {}, nombre: {}, rol: {} },
      async authorize(c) {
        const email = String(c?.email ?? "").trim();
        if (!emailPermitido(email)) return null;
        const rol = ["responsable", "colaborador", "equipo"].includes(String(c?.rol)) ? (c!.rol as Rol) : undefined;
        const u = await asegurarUsuario(email, c?.nombre ? String(c.nombre) : undefined, rol);
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
      if (user?.id) token.uid = user.id;
      if (token.uid) {
        const u = await db.usuario.findUnique({ where: { id: token.uid as string } });
        if (!u) return null;
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
