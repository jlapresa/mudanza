import { Prisma } from "@prisma/client";
import { db } from "./db";
import { CAMPO, etiquetaDecision } from "./textos";

export const incluirTarjeta = Prisma.validator<Prisma.ArticuloInclude>()({
  fotos: { where: { principal: true }, take: 1, select: { id: true } },
  zonaDestino: { select: { nombre: true } },
  salaOrigen: { select: { nombre: true, planta: true } },
  _count: { select: { peticiones: { where: { estado: { in: ["abierta", "asignada"] } } } } },
});

export async function cargarFicha(codigo: string) {
  const a = await db.articulo.findUnique({
    where: { codigo },
    include: {
      salaOrigen: true,
      zonaDestino: true,
      decididoPor: { select: { nombre: true } },
      fotos: { orderBy: [{ principal: "desc" }, { creadaEn: "asc" }] },
      peticiones: { orderBy: { creadaEn: "asc" }, include: { usuario: { select: { nombre: true, email: true } } } },
      eventos: { orderBy: { creadoEn: "desc" }, take: 100, include: { usuario: { select: { nombre: true } } } },
      padre: { select: { codigo: true } },
      partes: { select: { codigo: true, cantidad: true }, orderBy: { codigo: "asc" } },
    },
  });
  if (!a) return null;
  return {
    id: a.id,
    codigo: a.codigo,
    nombre: a.nombre,
    descripcion: a.descripcion,
    categoria: a.categoria,
    cantidad: a.cantidad,
    medidas: a.medidas,
    estado: a.estado,
    sala: `${a.salaOrigen.nombre} · ${a.salaOrigen.planta}`,
    salaId: a.salaOrigenId,
    decision: a.decision,
    zonaDestinoId: a.zonaDestinoId,
    zonaNombre: a.zonaDestino?.nombre ?? null,
    salida: a.salida,
    etiqueta: etiquetaDecision(a.decision, a.salida, a.zonaDestino?.nombre),
    notasDecision: a.notasDecision,
    decididoPor: a.decididoPor?.nombre ?? null,
    decididoEn: a.decididoEn?.toISOString() ?? null,
    original: (a.camposOriginales as any)?.texto ?? null,
    padre: a.padre?.codigo ?? null,
    partes: a.partes,
    fotos: a.fotos.map((f) => ({ id: f.id, principal: f.principal })),
    peticiones: a.peticiones.map((p) => ({
      id: p.id, nombre: p.usuario.nombre, email: p.usuario.email, cantidad: p.cantidad, comentario: p.comentario,
      estado: p.estado, creadaEn: p.creadaEn.toISOString(), recogidaLimite: p.recogidaLimite?.toISOString() ?? null,
    })),
    eventos: a.eventos.map((e) => ({
      id: e.id, quien: e.usuario?.nombre ?? "Sistema", cuando: e.creadoEn.toISOString(), tipo: e.tipo,
      campo: e.campo ? CAMPO[e.campo] ?? e.campo : null, antes: e.valorAnterior, despues: e.valorNuevo,
    })),
  };
}
export type DatosFicha = NonNullable<Awaited<ReturnType<typeof cargarFicha>>>;

export async function zonasActivas() {
  return db.zonaDestino.findMany({ where: { activa: true }, orderBy: { orden: "asc" }, select: { id: true, nombre: true } });
}
