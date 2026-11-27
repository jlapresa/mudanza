import { manejar, apiUsuario } from "@/lib/sesion";
import { dividir } from "@/lib/articulos";
import { unaVez } from "@/lib/historial";

export const POST = manejar(async (req, { params }) => {
  const u = await apiUsuario("inventario");
  const { id } = await params;
  const { cantidad } = await req.json();
  const r = await unaVez(req.headers.get("x-operacion"), () => dividir(u, id, Number(cantidad)));
  return Response.json({ ok: true, codigo: r === "repetida" ? null : r.codigo });
});
