import { db } from "./db";
import { enviarCorreo } from "./correo";

const base = () => process.env.APP_URL ?? "http://localhost:3000";

export async function avisar(
  usuarioId: string,
  texto: string,
  enlace: string,
  correo?: { asunto: string; cuerpo: string },
) {
  await db.aviso.create({ data: { usuarioId, texto, enlace } });
  if (correo) {
    const u = await db.usuario.findUnique({ where: { id: usuarioId } });
    if (u) await enviarCorreo([u.email], correo.asunto, `${correo.cuerpo}\n\n${base()}${enlace}`).catch(console.error);
  }
}

export { base as urlBase };
