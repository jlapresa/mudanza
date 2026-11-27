import { db } from "./db";
import { registrar } from "./historial";
import { ErrorApi, type Usuario } from "./sesion";
import { avisar, avisarATodos } from "./avisos";
import { plazoMercadillo } from "./ajustes";
import { fecha } from "./textos";
import { leerAjuste, guardarAjuste } from "./ajustes";

export const enMercadillo = { decision: "no_llevar" as const, salida: "ofrecer_equipo" as const };

/** Unidades disponibles = cantidad menos lo ya asignado o recogido. */
export async function disponibles(articuloId: string) {
  const a = await db.articulo.findUniqueOrThrow({ where: { id: articuloId } });
  const ocupadas = await db.peticion.aggregate({
    where: { articuloId, estado: { in: ["asignada", "recogida"] } },
    _sum: { cantidad: true },
  });
  return a.cantidad - (ocupadas._sum.cantidad ?? 0);
}

export async function pedir(u: Usuario, articuloId: string, cantidad: number, comentario?: string | null) {
  const plazo = await plazoMercadillo();
  if (plazo.antes) throw new ErrorApi(400, `El mercadillo abre el ${fecha(plazo.apertura)}.`);
  if (plazo.cerrado) throw new ErrorApi(400, "El plazo del mercadillo ha terminado y ya no se admiten peticiones.");
  const a = await db.articulo.findUnique({ where: { id: articuloId } });
  if (!a || a.decision !== "no_llevar" || a.salida !== "ofrecer_equipo")
    throw new ErrorApi(400, "Este artículo no está en el mercadillo.");
  if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > a.cantidad)
    throw new ErrorApi(400, `Puedes pedir entre 1 y ${a.cantidad} unidades.`);
  const ya = await db.peticion.findFirst({ where: { articuloId, usuarioId: u.id, estado: { in: ["abierta", "asignada"] } } });
  if (ya) throw new ErrorApi(400, "Ya lo has pedido.");
  return db.$transaction(async (tx) => {
    const p = await tx.peticion.create({ data: { articuloId, usuarioId: u.id, cantidad, comentario: comentario || null } });
    await registrar(tx, { usuarioId: u.id, articuloId, tipo: "peticion", campo: "nueva", despues: `${u.name} pide ${cantidad}` });
    return p;
  });
}

export async function retirar(u: Usuario, peticionId: string) {
  const p = await db.peticion.findUnique({ where: { id: peticionId } });
  if (!p || p.usuarioId !== u.id) throw new ErrorApi(404, "Petición no encontrada.");
  if (p.estado !== "abierta") throw new ErrorApi(400, "Solo se puede retirar una petición abierta.");
  await db.$transaction(async (tx) => {
    await tx.peticion.update({ where: { id: p.id }, data: { estado: "retirada", cambiadaEn: new Date() } });
    await registrar(tx, { usuarioId: u.id, articuloId: p.articuloId, tipo: "peticion", campo: "estado", antes: "abierta", despues: `retirada por ${u.name}` });
  });
}

/**
 * Asigna peticiones de un artículo. Sin `peticionId`, sigue la regla de Quum:
 * por orden de llegada mientras queden unidades. Con `peticionId`, asigna esa (decisión manual).
 * Si no quedan unidades, el resto de peticiones abiertas pasan a «rechazada».
 */
export async function asignar(u: Usuario, articuloId: string, peticionId?: string) {
  const a = await db.articulo.findUnique({ where: { id: articuloId } });
  if (!a) throw new ErrorApi(404, "Artículo no encontrado.");
  const { recogidaDias } = await plazoMercadillo();
  const abiertas = await db.peticion.findMany({
    where: { articuloId, estado: "abierta" },
    orderBy: { creadaEn: "asc" },
    include: { usuario: true },
  });
  let libres = await disponibles(articuloId);
  const orden = peticionId ? abiertas.filter((p) => p.id === peticionId) : abiertas;
  if (peticionId && !orden.length) throw new ErrorApi(400, "Esa petición ya no está abierta.");

  const asignadas: typeof abiertas = [];
  for (const p of orden) {
    if (p.cantidad <= libres) {
      asignadas.push(p);
      libres -= p.cantidad;
    }
  }
  if (peticionId && !asignadas.length) throw new ErrorApi(400, "No quedan unidades suficientes para esa petición.");
  const restantes = abiertas.filter((p) => !asignadas.includes(p) && p.cantidad > libres);
  const limite = new Date(Date.now() + recogidaDias * 86400_000);

  await db.$transaction(async (tx) => {
    for (const p of asignadas) {
      await tx.peticion.update({ where: { id: p.id }, data: { estado: "asignada", recogidaLimite: limite, cambiadaEn: new Date() } });
      await registrar(tx, {
        usuarioId: u.id, articuloId, tipo: "asignacion", campo: "peticion",
        antes: "abierta", despues: `asignada a ${p.usuario.nombre} (${p.cantidad})${peticionId ? " · manual" : " · orden de llegada"}`,
      });
    }
    for (const p of restantes) {
      await tx.peticion.update({ where: { id: p.id }, data: { estado: "rechazada", cambiadaEn: new Date() } });
      await registrar(tx, { usuarioId: u.id, articuloId, tipo: "asignacion", campo: "peticion", antes: "abierta", despues: `no asignada a ${p.usuario.nombre}` });
    }
  });

  for (const p of asignadas)
    await avisar(p.usuarioId, `«${a.nombre}» es para ti. Recógelo antes del ${fecha(limite)}.`, "/mis-peticiones");
  for (const p of restantes)
    await avisar(p.usuarioId, `«${a.nombre}» se ha asignado a otra persona que lo pidió antes.`, "/mis-peticiones");
  return { asignadas: asignadas.length, rechazadas: restantes.length };
}

export async function marcarRecogida(u: Usuario, peticionId: string) {
  const p = await db.peticion.findUnique({ where: { id: peticionId }, include: { usuario: true } });
  if (!p || p.estado !== "asignada") throw new ErrorApi(400, "Solo se puede marcar como recogida una petición asignada.");
  await db.$transaction(async (tx) => {
    await tx.peticion.update({ where: { id: p.id }, data: { estado: "recogida", cambiadaEn: new Date() } });
    await registrar(tx, { usuarioId: u.id, articuloId: p.articuloId, tipo: "peticion", campo: "estado", antes: "asignada", despues: `recogida por ${p.usuario.nombre}` });
  });
}

/** Avisos programados: apertura del mercadillo y recordatorio dos días antes del cierre. Idempotente. */
export async function tareasProgramadas(ahora = new Date()) {
  const plazo = await plazoMercadillo();
  const hechos: string[] = [];
  if (ahora >= plazo.apertura && ahora <= plazo.cierre && !(await leerAjuste("aviso_apertura"))) {
    const n = await db.articulo.count({ where: enMercadillo });
    await avisarATodos(`Abre el mercadillo: ${n} artículos que no nos llevamos. Pide lo que quieras antes del ${fecha(plazo.cierre)}; se asigna por orden de llegada.`, "/mercadillo");
    await guardarAjuste("aviso_apertura", ahora.toISOString());
    hechos.push("apertura");
  }
  // Dos días antes del cierre, desde las 00:00 de ese día en Madrid (la tarea diaria corre por la mañana).
  const diaCierre = plazo.cierre.toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" });
  const recordatorio = new Date(new Date(`${diaCierre}T00:00:00+01:00`).getTime() - 2 * 86400_000);
  if (ahora >= recordatorio && ahora <= plazo.cierre && !(await leerAjuste("aviso_recordatorio"))) {
    await avisarATodos(`Quedan dos días de mercadillo: cierra el ${fecha(plazo.cierre)}.`, "/mercadillo");
    await guardarAjuste("aviso_recordatorio", ahora.toISOString());
    hechos.push("recordatorio");
  }
  return hechos;
}
