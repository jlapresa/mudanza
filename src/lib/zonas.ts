import { db } from "./db";

// Zonas de la oficina nueva (distribución definitiva, 28 de noviembre de 2026).
export const ZONAS_INICIALES = [
  "Entrada",
  "Sala de reuniones 1",
  "Grada",
  "Barrio A",
  "Sala de reuniones 2",
  "Barrio B",
  "Administración",
  "Cocina - comedor",
  "Pasillo izquierdo",
  "Terraza",
];
const VERSION = "2";
let aplicada = false;

/**
 * Deja las zonas como en ZONAS_INICIALES, una sola vez por versión.
 * Las zonas antiguas sin muebles se borran. Las que tienen muebles se desactivan
 * para no perder decisiones: siguen visibles en «Por destino» para reasignarlas.
 */
export async function asegurarZonas() {
  if (aplicada) return;
  const v = await db.ajuste.findUnique({ where: { clave: "zonas_version" } });
  if (v?.valor === VERSION) {
    aplicada = true;
    return;
  }
  await db.$transaction(async (tx) => {
    for (const [i, nombre] of ZONAS_INICIALES.entries())
      await tx.zonaDestino.upsert({ where: { nombre }, create: { nombre, orden: i + 1 }, update: { orden: i + 1, activa: true } });
    const antiguas = await tx.zonaDestino.findMany({
      where: { nombre: { notIn: ZONAS_INICIALES } },
      include: { _count: { select: { articulos: true } } },
    });
    for (const [i, z] of antiguas.entries()) {
      if (z._count.articulos === 0) await tx.zonaDestino.delete({ where: { id: z.id } });
      else await tx.zonaDestino.update({ where: { id: z.id }, data: { activa: false, orden: 100 + i } });
    }
    await tx.evento.create({ data: { tipo: "ajuste", campo: "zonas", valorNuevo: `Nueva distribución: ${ZONAS_INICIALES.join(", ")}` } });
    await tx.ajuste.upsert({ where: { clave: "zonas_version" }, create: { clave: "zonas_version", valor: VERSION }, update: { valor: VERSION } });
  });
  aplicada = true;
}
