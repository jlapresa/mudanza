import type { Categoria, Decision, Estado, Salida } from "@prisma/client";
import { z } from "zod";
import { db } from "./db";
import { registrar } from "./historial";
import { ErrorApi, type Usuario } from "./sesion";
import { avisar } from "./avisos";
import { SALIDA } from "./textos";

export const esquemaDecision = z.object({
  decision: z.enum(["pendiente", "llevar", "no_llevar"]),
  zonaDestinoId: z.string().nullish(),
  salida: z.enum(["ofrecer_equipo", "vender", "donar", "reciclar", "dejar_en_local", "devolver"]).nullish(),
  notasDecision: z.string().max(2000).nullish(),
});

export async function decidir(u: Usuario, articuloId: string, datos: z.infer<typeof esquemaDecision>) {
  const { decision } = datos;
  let zonaDestinoId: string | null = null;
  let salida: Salida | null = null;
  if (decision === "llevar") {
    if (!datos.zonaDestinoId) throw new ErrorApi(400, "Elige la zona de destino para guardar «Se lleva».");
    const z = await db.zonaDestino.findUnique({ where: { id: datos.zonaDestinoId } });
    if (!z) throw new ErrorApi(400, "Esa zona de destino no existe.");
    zonaDestinoId = z.id;
  }
  if (decision === "no_llevar") {
    if (!datos.salida) throw new ErrorApi(400, "Elige qué se hace con él para guardar «No se lleva».");
    salida = datos.salida;
  }
  const a = await db.articulo.findUnique({ where: { id: articuloId }, include: { zonaDestino: true } });
  if (!a) throw new ErrorApi(404, "Artículo no encontrado.");

  const notas = datos.notasDecision === undefined ? a.notasDecision : datos.notasDecision || null;
  const zonaNueva = zonaDestinoId ? (await db.zonaDestino.findUnique({ where: { id: zonaDestinoId } }))?.nombre : null;

  const salidaMercadillo = a.salida === "ofrecer_equipo" && salida !== "ofrecer_equipo";
  const afectadas = salidaMercadillo
    ? await db.peticion.findMany({ where: { articuloId, estado: "abierta" } })
    : [];

  await db.$transaction(async (tx) => {
    await tx.articulo.update({
      where: { id: articuloId },
      data: { decision, zonaDestinoId, salida, notasDecision: notas, decididoPorId: u.id, decididoEn: new Date() },
    });
    const ev = (campo: string, antes: unknown, despues: unknown) =>
      antes !== despues ? registrar(tx, { usuarioId: u.id, articuloId, tipo: "cambio", campo, antes, despues }) : null;
    await ev("decision", a.decision, decision);
    await ev("zonaDestino", a.zonaDestino?.nombre ?? null, zonaNueva ?? null);
    await ev("salida", a.salida ? SALIDA[a.salida] : null, salida ? SALIDA[salida] : null);
    await ev("notasDecision", a.notasDecision, notas);
    for (const p of afectadas) {
      await tx.peticion.update({ where: { id: p.id }, data: { estado: "rechazada", cambiadaEn: new Date() } });
      await registrar(tx, { usuarioId: u.id, articuloId, tipo: "peticion", campo: "estado", antes: "abierta", despues: "rechazada" });
    }
  });
  for (const p of afectadas)
    await avisar(p.usuarioId, `«${a.nombre}» ya no está en el mercadillo y tu petición se ha cerrado.`, "/mis-peticiones");
}

export const esquemaDatos = z.object({
  nombre: z.string().trim().min(1).max(200).optional(),
  descripcion: z.string().max(2000).nullish(),
  categoria: z.enum(["silla", "mesa", "armario", "estanteria", "sofa", "electronica", "decoracion", "otros"]).optional(),
  medidas: z.string().max(200).nullish(),
  estado: z.enum(["bueno", "aceptable", "deteriorado"]).nullish(),
});

export async function editarDatos(u: Usuario, articuloId: string, datos: z.infer<typeof esquemaDatos>) {
  const a = await db.articulo.findUnique({ where: { id: articuloId } });
  if (!a) throw new ErrorApi(404, "Artículo no encontrado.");
  const cambios: Record<string, unknown> = {};
  for (const k of ["nombre", "descripcion", "categoria", "medidas", "estado"] as const) {
    if (datos[k] === undefined) continue;
    const v = datos[k] === "" ? null : datos[k];
    if ((a as any)[k] !== v) cambios[k] = v;
  }
  if (!Object.keys(cambios).length) return;
  await db.$transaction(async (tx) => {
    await tx.articulo.update({
      where: { id: articuloId },
      data: cambios as { nombre?: string; descripcion?: string; categoria?: Categoria; medidas?: string; estado?: Estado },
    });
    for (const [k, v] of Object.entries(cambios))
      await registrar(tx, { usuarioId: u.id, articuloId, tipo: "cambio", campo: k, antes: (a as any)[k], despues: v });
  });
}

/** Separa `cantidad` unidades de una línea en un artículo nuevo con su propia decisión. */
export async function dividir(u: Usuario, articuloId: string, cantidad: number) {
  const a = await db.articulo.findUnique({ where: { id: articuloId }, include: { fotos: true } });
  if (!a) throw new ErrorApi(404, "Artículo no encontrado.");
  if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad >= a.cantidad)
    throw new ErrorApi(400, `Indica entre 1 y ${a.cantidad - 1} unidades para separar.`);
  const abiertas = await db.peticion.count({ where: { articuloId, estado: { in: ["abierta", "asignada"] } } });
  if (abiertas) throw new ErrorApi(400, "No se puede dividir mientras tenga peticiones del equipo activas.");

  const raiz = a.padreId ? await db.articulo.findUniqueOrThrow({ where: { id: a.padreId } }) : a;
  const hermanos = await db.articulo.count({ where: { OR: [{ padreId: raiz.id }, { id: raiz.id }] } });
  const codigo = `${raiz.codigo}-${String.fromCharCode(65 + hermanos)}`; // QM-0053-B, -C…

  return db.$transaction(async (tx) => {
    await tx.articulo.update({ where: { id: a.id }, data: { cantidad: a.cantidad - cantidad } });
    const nuevo = await tx.articulo.create({
      data: {
        codigo,
        nombre: a.nombre,
        descripcion: a.descripcion,
        categoria: a.categoria,
        cantidad,
        medidas: a.medidas,
        estado: a.estado,
        salaOrigenId: a.salaOrigenId,
        posicion: a.posicion,
        padreId: raiz.id,
        camposOriginales: a.camposOriginales ?? undefined,
        fotos: {
          create: a.fotos.map((f) => ({
            clave: f.clave, claveMini: f.claveMini, principal: f.principal, ancho: f.ancho, alto: f.alto, subidaPorId: f.subidaPorId,
          })),
        },
      },
    });
    await registrar(tx, { usuarioId: u.id, articuloId: a.id, tipo: "division", campo: "cantidad", antes: a.cantidad, despues: `${a.cantidad - cantidad} (se separan ${cantidad} en ${codigo})` });
    await registrar(tx, { usuarioId: u.id, articuloId: nuevo.id, tipo: "division", campo: "cantidad", antes: null, despues: `${cantidad} separadas de ${a.codigo}` });
    return nuevo;
  });
}

export type Filtros = {
  q?: string;
  decision?: Decision | "";
  zona?: string;
  salida?: Salida | "";
  foto?: "con" | "sin" | "";
  peticiones?: "si" | "";
  sala?: string;
};

export function whereFiltros(f: Filtros) {
  const w: any = { AND: [] as any[] };
  if (f.sala) w.AND.push({ salaOrigenId: f.sala });
  if (f.q) {
    const q = f.q.trim();
    w.AND.push({
      OR: [
        { nombre: { contains: q, mode: "insensitive" } },
        { codigo: { contains: q, mode: "insensitive" } },
        { descripcion: { contains: q, mode: "insensitive" } },
        { medidas: { contains: q, mode: "insensitive" } },
      ],
    });
  }
  if (f.decision) w.AND.push({ decision: f.decision });
  if (f.zona) w.AND.push({ zonaDestinoId: f.zona });
  if (f.salida) w.AND.push({ salida: f.salida });
  if (f.foto === "con") w.AND.push({ fotos: { some: {} } });
  if (f.foto === "sin") w.AND.push({ fotos: { none: {} } });
  if (f.peticiones === "si") w.AND.push({ peticiones: { some: { estado: { in: ["abierta", "asignada"] } } } });
  return w;
}

export function leerFiltros(sp: Record<string, string | string[] | undefined>): Filtros {
  const g = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  return {
    q: g("q"),
    decision: g("decision") as Filtros["decision"],
    zona: g("zona"),
    salida: g("salida") as Filtros["salida"],
    foto: g("foto") as Filtros["foto"],
    peticiones: g("peticiones") as Filtros["peticiones"],
  };
}

export const ORDEN_ARTICULOS = [{ salaOrigen: { orden: "asc" as const } }, { posicion: "asc" as const }, { codigo: "asc" as const }];
