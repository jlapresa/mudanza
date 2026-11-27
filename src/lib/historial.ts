import type { Prisma } from "@prisma/client";
import { db } from "./db";

type Tx = Prisma.TransactionClient | typeof db;

export async function registrar(
  tx: Tx,
  e: { usuarioId?: string | null; articuloId?: string | null; tipo: string; campo?: string; antes?: unknown; despues?: unknown },
) {
  const s = (v: unknown) => (v === undefined || v === null || v === "" ? null : String(v));
  await tx.evento.create({
    data: {
      usuarioId: e.usuarioId ?? null,
      articuloId: e.articuloId ?? null,
      tipo: e.tipo,
      campo: e.campo ?? null,
      valorAnterior: s(e.antes),
      valorNuevo: s(e.despues),
    },
  });
}

/** Ejecuta una operación una sola vez por id de cliente (cola sin conexión). */
export async function unaVez<T>(idCliente: string | null | undefined, fn: () => Promise<T>): Promise<T | "repetida"> {
  if (!idCliente) return fn();
  const ya = await db.operacionCliente.findUnique({ where: { id: idCliente } });
  if (ya) return "repetida";
  const r = await fn();
  await db.operacionCliente.create({ data: { id: idCliente } }).catch(() => {});
  return r;
}
