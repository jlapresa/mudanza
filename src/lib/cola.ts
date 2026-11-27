"use client";
// Cola de cambios sin conexión. Cada operación lleva un id único; el servidor
// ignora las repetidas, así que reenviar es seguro.
import { get, set } from "idb-keyval";

type Parte = { nombre: string; valor: string } | { nombre: string; blob: Blob; archivo: string };
export type Operacion = {
  id: string;
  url: string;
  metodo: string;
  json?: unknown;
  partes?: Parte[];
  descripcion: string;
};

const CLAVE = "cola-mudanza";
let procesando = false;

export const nuevoId = () =>
  (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now() + Math.random()));

async function leerCola(): Promise<Operacion[]> {
  try {
    return (await get(CLAVE)) ?? [];
  } catch {
    return [];
  }
}
async function guardarCola(c: Operacion[]) {
  await set(CLAVE, c);
  window.dispatchEvent(new CustomEvent("cola", { detail: c.length }));
}

function peticion(op: Operacion): RequestInit {
  const headers: Record<string, string> = { "x-operacion": op.id };
  if (op.partes) {
    const fd = new FormData();
    for (const p of op.partes) "blob" in p ? fd.append(p.nombre, p.blob, p.archivo) : fd.append(p.nombre, p.valor);
    return { method: op.metodo, body: fd, headers };
  }
  headers["content-type"] = "application/json";
  return { method: op.metodo, body: JSON.stringify(op.json ?? {}), headers };
}

export type Resultado = { ok: true; datos: any; enCola?: boolean } | { ok: false; error: string };

/** Envía una operación. Si no hay conexión, la deja en cola y devuelve ok con enCola. */
export async function enviar(op: Omit<Operacion, "id"> & { id?: string }): Promise<Resultado> {
  const completa: Operacion = { id: op.id ?? nuevoId(), ...op } as Operacion;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return encolar(completa);
  try {
    const r = await fetch(completa.url, peticion(completa));
    const datos = await r.json().catch(() => ({}));
    if (r.status >= 500) return encolar(completa);
    if (!r.ok) return { ok: false, error: datos.error ?? "No se ha podido guardar." };
    return { ok: true, datos };
  } catch {
    return encolar(completa);
  }
}

async function encolar(op: Operacion): Promise<Resultado> {
  const c = await leerCola();
  c.push(op);
  await guardarCola(c);
  return { ok: true, datos: {}, enCola: true };
}

export async function procesarCola() {
  if (procesando) return;
  procesando = true;
  try {
    let c = await leerCola();
    while (c.length) {
      const op = c[0];
      let r: Response;
      try {
        r = await fetch(op.url, peticion(op));
      } catch {
        break; // seguimos sin conexión
      }
      if (r.status >= 500) break;
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        window.dispatchEvent(new CustomEvent("cola-error", { detail: `${op.descripcion}: ${d.error ?? r.status}` }));
      }
      c = (await leerCola()).filter((x) => x.id !== op.id);
      await guardarCola(c);
    }
    window.dispatchEvent(new CustomEvent("cola-vaciada"));
  } finally {
    procesando = false;
  }
}

export async function pendientes() {
  return (await leerCola()).length;
}
