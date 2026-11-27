import { manejar, apiUsuario } from "@/lib/sesion";
import { db } from "@/lib/db";

export const POST = manejar(async () => {
  const u = await apiUsuario("sesion");
  await db.aviso.updateMany({ where: { usuarioId: u.id, leido: false }, data: { leido: true } });
  return Response.json({ ok: true });
});
