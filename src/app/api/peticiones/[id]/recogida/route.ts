import { manejar, apiUsuario } from "@/lib/sesion";
import { marcarRecogida } from "@/lib/mercadillo";

export const POST = manejar(async (_req, { params }) => {
  const u = await apiUsuario("responsable");
  const { id } = await params;
  await marcarRecogida(u, id);
  return Response.json({ ok: true });
});
