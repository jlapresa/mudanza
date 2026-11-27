import { manejar, apiUsuario } from "@/lib/sesion";
import { retirar } from "@/lib/mercadillo";

export const POST = manejar(async (_req, { params }) => {
  const u = await apiUsuario("sesion");
  const { id } = await params;
  await retirar(u, id);
  return Response.json({ ok: true });
});
