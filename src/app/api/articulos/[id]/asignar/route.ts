import { manejar, apiUsuario } from "@/lib/sesion";
import { asignar } from "@/lib/mercadillo";

export const POST = manejar(async (req, { params }) => {
  const u = await apiUsuario("responsable");
  const { id } = await params;
  const { peticionId } = await req.json().catch(() => ({}));
  const r = await asignar(u, id, peticionId || undefined);
  return Response.json({ ok: true, ...r });
});
