import { manejar, apiUsuario, ErrorApi } from "@/lib/sesion";
import { db } from "@/lib/db";
import { registrar } from "@/lib/historial";

export const POST = manejar(async (_req, { params }) => {
  const u = await apiUsuario("inventario");
  const { id } = await params;
  const f = await db.foto.findUnique({ where: { id } });
  if (!f) throw new ErrorApi(404, "Foto no encontrada.");
  await db.$transaction(async (tx) => {
    await tx.foto.updateMany({ where: { articuloId: f.articuloId }, data: { principal: false } });
    await tx.foto.update({ where: { id }, data: { principal: true } });
    await registrar(tx, { usuarioId: u.id, articuloId: f.articuloId, tipo: "foto", campo: "foto", despues: "nueva foto principal" });
  });
  return Response.json({ ok: true });
});
