import { promises as fs } from "fs";
import path from "path";
import { db } from "./db";

// Correo con Resend (https://resend.com). Sin RESEND_API_KEY, el correo se escribe en la consola.
const LOTE = 49; // Resend admite 50 destinatarios por mensaje; el remitente ocupa uno.

async function capturar(para: string[], asunto: string, texto: string) {
  // Solo en pruebas automáticas: deja cada correo en un archivo para poder leerlo.
  const dir = process.env.E2E_CORREOS_DIR;
  if (!dir) return;
  await fs.mkdir(dir, { recursive: true });
  await fs.appendFile(path.join(dir, "correos.jsonl"), JSON.stringify({ para, asunto, texto }) + "\n");
}

export async function enviarCorreo(para: string[], asunto: string, texto: string, opciones: { registrar?: boolean } = {}) {
  const destinatarios = [...new Set(para.filter(Boolean).map((s) => s.toLowerCase()))];
  if (!destinatarios.length) return;
  const clave = process.env.RESEND_API_KEY;
  const remitente = process.env.CORREO_REMITENTE ?? "Mudanza Quum <mudanza@quum.com>";
  await capturar(destinatarios, asunto, texto);

  if (!clave) {
    console.log(`[correo sin configurar] Para: ${destinatarios.join(", ")} · ${asunto}\n${texto}\n`);
  } else {
    for (let i = 0; i < destinatarios.length; i += LOTE) {
      const lote = destinatarios.slice(i, i + LOTE);
      const masivo = lote.length > 1;
      const direccion = remitente.match(/<(.+)>/)?.[1] ?? remitente;
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${clave}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: remitente,
          subject: asunto,
          text: texto,
          ...(masivo ? { to: [direccion], bcc: lote } : { to: lote }),
        }),
      });
      if (!r.ok) {
        const error = await r.text();
        console.error("Fallo al enviar correo", r.status, error);
        throw new Error("No se ha podido enviar el correo.");
      }
    }
  }
  if (opciones.registrar !== false)
    await db.evento.create({ data: { tipo: clave ? "correo" : "correo_simulado", campo: asunto, valorNuevo: destinatarios.join(", ") } });
}

export async function correosEquipo(): Promise<string[]> {
  const lista = process.env.CORREO_EQUIPO;
  if (lista) return lista.split(",").map((s) => s.trim());
  const us = await db.usuario.findMany({ select: { email: true } });
  return us.map((u) => u.email);
}
