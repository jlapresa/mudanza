import { db } from "./db";

export const AJUSTES_INICIALES: Record<string, string> = {
  mercadillo_apertura: "2026-12-10T08:00:00+01:00",
  mercadillo_cierre: "2026-12-16T23:59:00+01:00",
  recogida_dias: "7",
};

export async function leerAjuste(clave: string): Promise<string> {
  const a = await db.ajuste.findUnique({ where: { clave } });
  return a?.valor ?? AJUSTES_INICIALES[clave] ?? "";
}

export async function guardarAjuste(clave: string, valor: string) {
  await db.ajuste.upsert({ where: { clave }, create: { clave, valor }, update: { valor } });
}

export async function plazoMercadillo() {
  const apertura = new Date(await leerAjuste("mercadillo_apertura"));
  const cierre = new Date(await leerAjuste("mercadillo_cierre"));
  const recogidaDias = Number(await leerAjuste("recogida_dias")) || 7;
  const ahora = new Date();
  return {
    apertura,
    cierre,
    recogidaDias,
    abierto: ahora >= apertura && ahora <= cierre,
    antes: ahora < apertura,
    cerrado: ahora > cierre,
  };
}
