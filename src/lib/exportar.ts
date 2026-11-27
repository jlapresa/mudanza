import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { db } from "./db";
import { leer } from "./almacen";
import { CATEGORIA, DECISION, ESTADO, SALIDA, fecha } from "./textos";
import type { Salida } from "@prisma/client";

const incluir = {
  salaOrigen: true,
  zonaDestino: true,
  decididoPor: { select: { nombre: true } },
  fotos: { where: { principal: true }, take: 1 },
  peticiones: { where: { estado: { in: ["asignada", "recogida"] as ("asignada" | "recogida")[] } }, include: { usuario: true } },
};

async function articulos(where: object = {}) {
  return db.articulo.findMany({ where, include: incluir, orderBy: [{ salaOrigen: { orden: "asc" } }, { posicion: "asc" }, { codigo: "asc" }] });
}
type A = Awaited<ReturnType<typeof articulos>>[number];

export async function grupoMudanza() {
  const zonas = await db.zonaDestino.findMany({ orderBy: { orden: "asc" } });
  const as = await articulos({ decision: "llevar" });
  return zonas.map((z) => ({ titulo: z.nombre, items: as.filter((a) => a.zonaDestinoId === z.id) })).filter((g) => g.items.length);
}

const ORDEN_SALIDAS: Salida[] = ["ofrecer_equipo", "donar", "vender", "reciclar", "dejar_en_local", "devolver"];
export async function grupoSalidas() {
  const as = await articulos({ decision: "no_llevar" });
  return ORDEN_SALIDAS.map((s) => ({ titulo: SALIDA[s], items: as.filter((a) => a.salida === s) })).filter((g) => g.items.length);
}

const asignados = (a: A) => a.peticiones.map((p) => `${p.usuario.nombre} (${p.cantidad})${p.estado === "recogida" ? " ✓" : ""}`).join(", ");

export async function excelGrupos(titulo: string, grupos: { titulo: string; items: A[] }[], equipo: boolean) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(titulo.slice(0, 31));
  ws.columns = [
    { header: "Grupo", key: "g", width: 26 },
    { header: "Código", key: "c", width: 12 },
    { header: "Artículo", key: "n", width: 36 },
    { header: "Cantidad", key: "q", width: 10 },
    { header: "Medidas", key: "m", width: 22 },
    { header: "Sala de origen", key: "s", width: 28 },
    { header: "Planta", key: "p", width: 16 },
    ...(equipo ? [{ header: "Asignado a", key: "x", width: 34 }] : []),
    { header: "Notas", key: "o", width: 40 },
  ];
  ws.getRow(1).font = { bold: true };
  for (const g of grupos)
    for (const a of g.items)
      ws.addRow({ g: g.titulo, c: a.codigo, n: a.nombre, q: a.cantidad, m: a.medidas, s: a.salaOrigen.nombre, p: a.salaOrigen.planta, x: asignados(a), o: a.notasDecision });
  ws.views = [{ state: "frozen", ySplit: 1 }];
  ws.autoFilter = { from: "A1", to: { row: 1, column: ws.columns.length } };
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export async function excelCompleto() {
  const as = await articulos();
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Inventario");
  ws.columns = [
    ["Código", 12], ["Nombre", 34], ["Descripción", 30], ["Categoría", 14], ["Cantidad", 9], ["Medidas", 20], ["Estado", 12],
    ["Planta", 14], ["Sala de origen", 26], ["Posición", 9], ["Decisión", 12], ["Zona de destino", 24], ["Salida", 20],
    ["Notas", 36], ["Decidido por", 18], ["Decidido el", 18], ["Asignado a", 30], ["Fotos", 7], ["Separado de", 12],
    ["Original: texto", 40], ["Original: planta", 16], ["Original: sala", 24], ["Original: posición", 10], ["Original: archivo", 30],
  ].map(([header, width]) => ({ header: header as string, width: width as number }));
  ws.getRow(1).font = { bold: true };
  const fotos = await db.foto.groupBy({ by: ["articuloId"], _count: true });
  const nf = new Map(fotos.map((f) => [f.articuloId, f._count]));
  const padres = new Map(as.map((a) => [a.id, a.codigo]));
  for (const a of as) {
    const o = (a.camposOriginales ?? {}) as Record<string, unknown>;
    ws.addRow([
      a.codigo, a.nombre, a.descripcion, CATEGORIA[a.categoria], a.cantidad, a.medidas, a.estado ? ESTADO[a.estado] : "",
      a.salaOrigen.planta, a.salaOrigen.nombre, a.posicion, DECISION[a.decision], a.zonaDestino?.nombre ?? "",
      a.salida ? SALIDA[a.salida] : "", a.notasDecision, a.decididoPor?.nombre ?? "", a.decididoEn ? fecha(a.decididoEn, true) : "",
      asignados(a), nf.get(a.id) ?? 0, a.padreId ? padres.get(a.padreId) ?? "" : "",
      o.texto ?? "", o.planta ?? "", o.sala ?? "", o.posicion ?? "", o.archivo ?? "",
    ]);
  }
  ws.views = [{ state: "frozen", ySplit: 1 }];
  ws.autoFilter = { from: "A1", to: { row: 1, column: 24 } };
  const wh = wb.addWorksheet("Historial");
  wh.columns = [{ header: "Fecha", width: 20 }, { header: "Quién", width: 20 }, { header: "Artículo", width: 12 }, { header: "Tipo", width: 12 }, { header: "Campo", width: 18 }, { header: "Antes", width: 30 }, { header: "Después", width: 40 }];
  wh.getRow(1).font = { bold: true };
  const ev = await db.evento.findMany({ orderBy: { creadoEn: "asc" }, include: { usuario: true, articulo: { select: { codigo: true } } } });
  for (const e of ev) wh.addRow([fecha(e.creadoEn, true), e.usuario?.nombre ?? "Sistema", e.articulo?.codigo ?? "", e.tipo, e.campo, e.valorAnterior, e.valorNuevo]);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export async function pdfGrupos(titulo: string, subtitulo: string, grupos: { titulo: string; items: A[] }[], equipo: boolean) {
  const doc = new PDFDocument({ size: "A4", margin: 36, info: { Title: titulo } });
  const partes: Buffer[] = [];
  doc.on("data", (c) => partes.push(c));
  const fin = new Promise<Buffer>((ok) => doc.on("end", () => ok(Buffer.concat(partes))));
  const W = doc.page.width - 72;
  const total = grupos.reduce((s, g) => s + g.items.reduce((t, a) => t + a.cantidad, 0), 0);

  doc.font("Helvetica-Bold").fontSize(18).text(titulo);
  doc.font("Helvetica").fontSize(10).fillColor("#555").text(`${subtitulo} · ${total} unidades · ${fecha(new Date(), true)}`);
  doc.fillColor("#000").moveDown();

  const FILA = 58;
  for (const g of grupos) {
    if (doc.y > doc.page.height - 36 - FILA * 2) doc.addPage();
    const uds = g.items.reduce((s, a) => s + a.cantidad, 0);
    doc.moveDown(0.5).font("Helvetica-Bold").fontSize(14).text(`${g.titulo}  ·  ${uds} ${uds === 1 ? "unidad" : "unidades"}`, 36);
    doc.moveTo(36, doc.y + 2).lineTo(36 + W, doc.y + 2).strokeColor("#999").stroke();
    doc.moveDown(0.4);
    for (const a of g.items) {
      if (doc.y > doc.page.height - 36 - FILA) doc.addPage();
      const y = doc.y;
      const f = a.fotos[0];
      const img = f ? await leer(f.claveMini) : null;
      if (img) {
        try { doc.image(img, 36, y, { fit: [64, 50], align: "center", valign: "center" }); } catch { /* imagen no válida */ }
      } else {
        doc.rect(36, y, 64, 50).strokeColor("#ccc").stroke();
        doc.fontSize(7).fillColor("#999").text("Sin foto", 36, y + 21, { width: 64, align: "center" }).fillColor("#000");
      }
      const x = 110;
      doc.font("Helvetica-Bold").fontSize(11).text(`${a.codigo}  ${a.nombre}`, x, y, { width: W - 74 - 60 });
      doc.font("Helvetica-Bold").fontSize(11).text(`× ${a.cantidad}`, 36 + W - 60, y, { width: 60, align: "right" });
      doc.font("Helvetica").fontSize(9).fillColor("#444");
      const linea2 = [a.medidas, `Origen: ${a.salaOrigen.nombre} (${a.salaOrigen.planta})`].filter(Boolean).join(" · ");
      doc.text(linea2, x, doc.y + 1, { width: W - 74 });
      const extra = [equipo ? asignados(a) && `Para: ${asignados(a)}` : null, a.notasDecision].filter(Boolean).join(" · ");
      if (extra) doc.text(extra, x, doc.y, { width: W - 74, height: 22, ellipsis: true });
      doc.fillColor("#000");
      doc.y = Math.max(doc.y, y + FILA - 4);
      doc.moveTo(x, doc.y - 2).lineTo(36 + W, doc.y - 2).strokeColor("#eee").stroke();
    }
  }
  if (!grupos.length) doc.fontSize(12).text("No hay artículos todavía.");
  doc.end();
  return fin;
}
