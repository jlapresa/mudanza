import type { Categoria } from "@prisma/client";

// Lectura del inventario en Word (INVENTARIO_QUUM_MUDANZA.docx).
// El documento es una lista de párrafos sin formato que distinga plantas, salas y artículos,
// así que se reconocen por nombre.

export const PLANTAS: Record<string, string> = {
  "SÓTANO": "Sótano",
  "PLANTA BAJA": "Planta baja",
  "PLANTA PRIMERA": "Planta primera",
  "PLANTA SEGUNDA": "Planta segunda",
};

export const SALAS: Record<string, string> = {
  "Garaje": "Garaje",
  "Almacén": "Almacén",
  "Despachos": "Despachos",
  "Cuartos de baño": "Cuartos de baño",
  "Cocina": "Cocina",
  "Cuarto Rac y tareas": "Cuarto del rack y tareas",
  "Entrada": "Entrada",
  "Despacho principal": "Despacho principal",
  "Comedor Pecera": "Comedor (pecera)",
  "Terraza planta principal": "Terraza planta principal",
  "Despacho contabilidad": "Despacho contabilidad",
  "Despacho creatividad": "Despacho creatividad",
  "Despacho Live": "Despacho Live",
  "Sala de Juntas": "Sala de juntas",
  "Despacho arriba": "Despacho arriba",
  "Sala terraza": "Sala terraza",
};

const ERRATAS: [RegExp, string][] = [
  [/\bmedas\b/g, "mesas"],
  [/\bbancas\b/g, "blancas"],
  [/\bBajilla\b/g, "Vajilla"],
  [/\bencuadrenadora\b/g, "encuadernadora"],
  [/\bestanterias\b/g, "estanterías"],
  [/\bfrigo\b/g, "frigorífico"],
  [/\bporta rollos\b/g, "portarrollos"],
  [/sin Luz/g, "sin luz"],
];

const CATEGORIAS: [string, Categoria][] = [
  ["silla", "silla"], ["taburete", "silla"], ["banco", "silla"],
  ["butaca", "sofa"], ["sofá", "sofa"],
  ["mesa", "mesa"], ["mesita", "mesa"],
  ["armario", "armario"], ["mueble", "armario"],
  ["estanter", "estanteria"], ["balda", "estanteria"],
  ["pantalla", "electronica"], ["impresora", "electronica"], ["microondas", "electronica"], ["frigo", "electronica"],
  ["lavavajillas", "electronica"], ["cafetera", "electronica"], ["hervidor", "electronica"], ["tostador", "electronica"],
  ["guillotina", "electronica"], ["encuadern", "electronica"], ["fuente", "electronica"], ["luminoso", "electronica"],
  ["lámpara", "decoracion"], ["cubo", "decoracion"], ["cuadro", "decoracion"], ["planta", "decoracion"], ["perchero", "decoracion"],
];

const MEDIDAS = /(\d[\d,.]*\s*(?:x\s*\d[\d,.]*\s*){1,2}(?:cm)?(?:\s*alto)?(?:\s*cm)?|\d+\s*diámetro|ampliable a \d+\s*cm)/gi;
const LOTES = /^(Cubos|Tazas|Vasos|Jarras|Cajas|Varios|Bajilla|Vajilla)/i;
const DUDOSAS = /180x0?85|180x0,85|2x1cm|1x70cm|1x54|x2alto/;

export type LineaInventario = {
  planta: string;
  sala: string;
  salaOriginal: string;
  plantaOrden: number;
  salaOrden: number;
  posicion: number;
  nombre: string;
  cantidad: number;
  medidas: string | null;
  categoria: Categoria;
  original: string;
  avisos: string[];
  clave: string;
};

export function interpretar(parrafos: string[]): { lineas: LineaInventario[]; desconocidos: string[] } {
  const lineas: LineaInventario[] = [];
  const desconocidos: string[] = [];
  let planta: string | null = null;
  let plantaOrden = 0;
  let sala: string | null = null;
  let salaOriginal = "";
  let salaOrden = 0;
  let posicion = 0;

  for (const bruto of parrafos) {
    const t = bruto.trim();
    if (!t) continue;
    if (PLANTAS[t.toUpperCase()]) {
      planta = PLANTAS[t.toUpperCase()];
      plantaOrden++;
      continue;
    }
    if (SALAS[t]) {
      sala = SALAS[t];
      salaOriginal = t;
      salaOrden++;
      posicion = 0;
      continue;
    }
    if (!planta || !sala) {
      desconocidos.push(t);
      continue;
    }
    posicion++;
    const avisos: string[] = [];
    let cantidad = 1;
    let resto = t;
    const num = t.match(/^(\d+)\s+(.*)$/);
    const uno = t.match(/^(Un|Una)\s+(.*)$/i);
    if (num) {
      cantidad = Number(num[1]);
      resto = num[2];
    } else if (uno) {
      resto = uno[2];
    } else if (LOTES.test(t)) {
      avisos.push("Sin cantidad: entra como 1 lote");
    }
    const meds = resto.match(MEDIDAS) ?? [];
    let nombre = resto;
    for (const m of meds) nombre = nombre.replace(m, "");
    nombre = nombre.replace(/\s{2,}/g, " ").replace(/\s+de\s*$/, "").replace(/^[\s.,]+|[\s.,]+$/g, "");
    for (const [re, s] of ERRATAS) nombre = nombre.replace(re, s);
    if (nombre === "Varios…" || nombre === "Varios...") nombre = `Varios (${sala.toLowerCase()})`;
    nombre = nombre.charAt(0).toUpperCase() + nombre.slice(1);
    const low = nombre.toLowerCase();
    const categoria = CATEGORIAS.find(([k]) => low.includes(k))?.[1] ?? "otros";
    if (DUDOSAS.test(t)) avisos.push("Medidas dudosas: revisar");
    lineas.push({
      planta, sala, salaOriginal, plantaOrden, salaOrden, posicion, nombre, cantidad,
      medidas: meds.map((m) => m.trim()).join("; ") || null,
      categoria, original: bruto, avisos,
      clave: `${planta}|${sala}|${posicion}`,
    });
  }
  return { lineas, desconocidos };
}

export async function leerDocx(origen: string | Buffer): Promise<string[]> {
  const mammoth = await import("mammoth");
  const { value } = await mammoth.extractRawText(typeof origen === "string" ? { path: origen } : { buffer: origen });
  return value.split(/\n/);
}

export function resumen(lineas: LineaInventario[]) {
  const salas = new Map<string, { planta: string; sala: string; orden: number; lineas: number; unidades: number }>();
  for (const l of lineas) {
    const k = `${l.planta}|${l.sala}`;
    const s = salas.get(k) ?? { planta: l.planta, sala: l.sala, orden: l.salaOrden, lineas: 0, unidades: 0 };
    s.lineas++;
    s.unidades += l.cantidad;
    salas.set(k, s);
  }
  return { salas, unidades: lineas.reduce((s, l) => s + l.cantidad, 0) };
}

/** Guarda las líneas en la base. Repetible: las ya importadas (misma planta, sala y posición) no se tocan. */
export async function guardarInventario(db: import("@prisma/client").PrismaClient, lineas: LineaInventario[], archivo: string, usuarioId?: string) {
  const { ZONAS_INICIALES } = await import("./zonas");
  for (const [i, nombre] of ZONAS_INICIALES.entries())
    await db.zonaDestino.upsert({ where: { nombre }, create: { nombre, orden: i + 1 }, update: {} });
  await db.ajuste.upsert({ where: { clave: "zonas_version" }, create: { clave: "zonas_version", valor: "2" }, update: {} });

  const { salas } = resumen(lineas);
  const salaIds = new Map<string, string>();
  for (const [k, s] of salas) {
    const r = await db.salaOrigen.upsert({
      where: { planta_nombre: { planta: s.planta, nombre: s.sala } },
      create: { planta: s.planta, nombre: s.sala, orden: s.orden },
      update: { orden: s.orden },
    });
    salaIds.set(k, r.id);
  }
  const ya = new Set((await db.articulo.findMany({ where: { origenClave: { not: null } }, select: { origenClave: true } })).map((a) => a.origenClave));
  const raices = await db.articulo.findMany({ where: { padreId: null }, select: { codigo: true } });
  let siguiente = Math.max(0, ...raices.map((a) => Number(a.codigo.match(/^QM-(\d+)$/)?.[1] ?? 0))) + 1;
  let nuevos = 0;
  for (const l of lineas) {
    if (ya.has(l.clave)) continue;
    await db.articulo.create({
      data: {
        codigo: `QM-${String(siguiente++).padStart(4, "0")}`,
        nombre: l.nombre,
        cantidad: l.cantidad,
        medidas: l.medidas,
        categoria: l.categoria,
        salaOrigenId: salaIds.get(`${l.planta}|${l.sala}`)!,
        posicion: l.posicion,
        origenClave: l.clave,
        decision: "pendiente",
        notasDecision: l.avisos.length ? l.avisos.join(". ") + "." : null,
        camposOriginales: { texto: l.original.trim(), planta: l.planta, sala: l.salaOriginal, posicion: l.posicion, archivo },
        eventos: { create: { tipo: "importacion", valorNuevo: l.original.trim(), usuarioId: usuarioId ?? null } },
      },
    });
    nuevos++;
  }
  const total = await db.articulo.count({ where: { origenClave: { not: null } } });
  return { nuevos, existentes: lineas.length - nuevos, total };
}
