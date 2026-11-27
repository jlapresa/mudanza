import { db } from "./db";

// Avisos dentro de la app (la campana de la cabecera). La app no envía correo.
const base = () => process.env.APP_URL ?? "http://localhost:3000";

export async function avisar(usuarioId: string, texto: string, enlace: string) {
  await db.aviso.create({ data: { usuarioId, texto, enlace } });
}

export async function avisarATodos(texto: string, enlace: string) {
  const us = await db.usuario.findMany({ select: { id: true } });
  await db.aviso.createMany({ data: us.map((u) => ({ usuarioId: u.id, texto, enlace })) });
  return us.length;
}

export { base as urlBase };
