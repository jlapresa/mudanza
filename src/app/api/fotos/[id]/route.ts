import { manejar, apiUsuario, ErrorApi } from "@/lib/sesion";
import { db } from "@/lib/db";
import { leer } from "@/lib/almacen";
import { registrar } from "@/lib/historial";

export const GET = manejar(async (req, { params }) => {
  await apiUsuario("sesion");
  const { id } = await params;
  const f = await db.foto.findUnique({ where: { id } });
  if (!f) throw new ErrorApi(404, "Foto no encontrada.");
  const mini = new URL(req.url).searchParams.has("mini");
  const datos = await leer(mini ? f.claveMini : f.clave);
  if (!datos) throw new ErrorApi(404, "Foto no encontrada.");
  return new Response(new Uint8Array(datos), {
    headers: { "content-type": "image/jpeg", "cache-control": "private, max-age=31536000, immutable" },
  });
});

export const DELETE = manejar(async (_req, { params }) => {
  const u = await apiUsuario("inventario");
  const { id } = await params;
  const f = await db.foto.findUnique({ where: { id } });
  if (!f) return Response.json({ ok: true });
  await db.$transaction(async (tx) => {
    await tx.foto.delete({ where: { id } });
    if (f.principal) {
      const otra = await tx.foto.findFirst({ where: { articuloId: f.articuloId }, orderBy: { creadaEn: "asc" } });
      if (otra) await tx.foto.update({ where: { id: otra.id }, data: { principal: true } });
    }
    await registrar(tx, { usuarioId: u.id, articuloId: f.articuloId, tipo: "foto", campo: "foto", antes: "foto", despues: "foto eliminada" });
  });
  return Response.json({ ok: true });
});
