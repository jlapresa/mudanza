import { manejar, apiUsuario } from "@/lib/sesion";
import { pedir } from "@/lib/mercadillo";
import { unaVez } from "@/lib/historial";

export const POST = manejar(async (req, { params }) => {
  const u = await apiUsuario("sesion");
  const { id } = await params;
  const { cantidad, comentario } = await req.json();
  await unaVez(req.headers.get("x-operacion"), () => pedir(u, id, Number(cantidad) || 1, comentario ? String(comentario).slice(0, 500) : null));
  return Response.json({ ok: true });
});
