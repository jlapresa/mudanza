import { manejar, apiUsuario } from "@/lib/sesion";
import { decidir, esquemaDecision } from "@/lib/articulos";
import { unaVez } from "@/lib/historial";
import { ErrorApi } from "@/lib/sesion";

export const POST = manejar(async (req, { params }) => {
  const u = await apiUsuario("inventario");
  const { id } = await params;
  const d = esquemaDecision.safeParse(await req.json());
  if (!d.success) throw new ErrorApi(400, "Datos de la decisión no válidos.");
  await unaVez(req.headers.get("x-operacion"), () => decidir(u, id, d.data));
  return Response.json({ ok: true });
});
