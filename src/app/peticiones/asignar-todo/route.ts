import { db } from "@/lib/db";
import { apiUsuario, manejar } from "@/lib/sesion";
import { asignar } from "@/lib/mercadillo";

export const POST = manejar(async () => {
  const u = await apiUsuario("responsable");
  const as = await db.articulo.findMany({ where: { peticiones: { some: { estado: "abierta" } } }, select: { id: true } });
  for (const a of as) await asignar(u, a.id);
  return new Response(null, { status: 303, headers: { location: "/peticiones" } });
});
