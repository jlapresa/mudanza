import { tareasProgramadas } from "@/lib/mercadillo";
import { copiaDiaria } from "@/lib/copia";

// Vercel Cron la llama una vez al día (vercel.json) con la cabecera Authorization: Bearer CRON_SECRET.
// Envía los correos del mercadillo cuando toca y hace la copia diaria de la base de datos.
export const maxDuration = 60;

export async function GET(req: Request) {
  const clave = req.headers.get("authorization")?.replace("Bearer ", "") ?? new URL(req.url).searchParams.get("clave");
  if (!process.env.CRON_SECRET || clave !== process.env.CRON_SECRET) return new Response("No autorizado", { status: 401 });
  const correos = await tareasProgramadas();
  const copia = await copiaDiaria();
  return Response.json({ correos, copia });
}
