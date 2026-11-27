import { redirect } from "next/navigation";
import type { Rol } from "@prisma/client";
import { auth } from "@/auth";

export type Usuario = { id: string; rol: Rol; email: string; name: string };

export async function usuarioActual(): Promise<Usuario | null> {
  const s = await auth();
  return s?.user?.id ? (s.user as Usuario) : null;
}

export const puedeEditar = (u: Usuario | null) => !!u && (u.rol === "responsable" || u.rol === "colaborador");
export const esResponsable = (u: Usuario | null) => u?.rol === "responsable";

/** Para páginas: exige rol de inventario (responsable o colaborador). */
export async function exigirInventario() {
  const u = await usuarioActual();
  if (!u) redirect("/entrar");
  if (!puedeEditar(u)) redirect("/mercadillo");
  return u;
}
export async function exigirResponsablePagina() {
  const u = await usuarioActual();
  if (!u) redirect("/entrar");
  if (!esResponsable(u)) redirect("/");
  return u;
}
export async function exigirSesion() {
  const u = await usuarioActual();
  if (!u) redirect("/entrar");
  return u;
}

export class ErrorApi extends Error {
  constructor(public status: number, msg: string) {
    super(msg);
  }
}

/** Para rutas de API. */
export async function apiUsuario(nivel: "sesion" | "inventario" | "responsable" = "sesion") {
  const u = await usuarioActual();
  if (!u) throw new ErrorApi(401, "Inicia sesión para continuar.");
  if (nivel === "inventario" && !puedeEditar(u)) throw new ErrorApi(403, "No tienes permiso para editar el inventario.");
  if (nivel === "responsable" && !esResponsable(u)) throw new ErrorApi(403, "Solo el responsable puede hacer esto.");
  return u;
}

export function manejar(fn: (req: Request, ctx: any) => Promise<Response>) {
  return async (req: Request, ctx: any) => {
    try {
      return await fn(req, ctx);
    } catch (e) {
      if (e instanceof ErrorApi) return Response.json({ error: e.message }, { status: e.status });
      console.error(e);
      return Response.json({ error: "Algo ha fallado. Vuelve a intentarlo." }, { status: 500 });
    }
  };
}
