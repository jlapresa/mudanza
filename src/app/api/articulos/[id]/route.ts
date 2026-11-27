import { manejar, apiUsuario, ErrorApi } from "@/lib/sesion";
import { editarDatos, esquemaDatos } from "@/lib/articulos";
import { unaVez } from "@/lib/historial";

export const PATCH = manejar(async (req, { params }) => {
  const u = await apiUsuario("inventario");
  const { id } = await params;
  const d = esquemaDatos.safeParse(await req.json());
  if (!d.success) throw new ErrorApi(400, "Revisa los datos: hay algún campo no válido.");
  await unaVez(req.headers.get("x-operacion"), () => editarDatos(u, id, d.data));
  return Response.json({ ok: true });
});
