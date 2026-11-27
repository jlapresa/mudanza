import QRCode from "qrcode";
import { db } from "@/lib/db";
import { exigirInventario } from "@/lib/sesion";
import { urlBase } from "@/lib/avisos";
import Imprimir from "./Imprimir";

// Hoja A4 de 3 × 8 etiquetas de 70 × 37 mm, sin márgenes (formato adhesivo estándar).
export default async function Etiquetas({ searchParams }: { searchParams: Promise<{ zona?: string; desde?: string }> }) {
  await exigirInventario();
  const sp = await searchParams;
  const zonas = await db.zonaDestino.findMany({ orderBy: { orden: "asc" } });
  const as = await db.articulo.findMany({
    where: { decision: "llevar", ...(sp.zona ? { zonaDestinoId: sp.zona } : {}) },
    include: { zonaDestino: true, salaOrigen: true },
    orderBy: [{ zonaDestino: { orden: "asc" } }, { codigo: "asc" }],
  });
  const etiquetas: { codigo: string; nombre: string; zona: string; n: number; de: number; qr: string; sala: string }[] = [];
  for (const a of as) {
    const qr = await QRCode.toString(`${urlBase()}/a/${a.codigo}`, { type: "svg", margin: 0, errorCorrectionLevel: "M" });
    for (let i = 1; i <= a.cantidad; i++)
      etiquetas.push({ codigo: a.codigo, nombre: a.nombre, zona: a.zonaDestino!.nombre, n: i, de: a.cantidad, qr, sala: a.salaOrigen.nombre });
  }
  const huecos = Math.max(0, Math.min(23, Number(sp.desde) || 0)); // para aprovechar hojas empezadas
  const todas = [...Array(huecos).fill(null), ...etiquetas];
  const hojas: (typeof etiquetas[number] | null)[][] = [];
  for (let i = 0; i < todas.length; i += 24) hojas.push(todas.slice(i, i + 24));
  return (
    <>
      <style>{`
        .hoja { width: 210mm; height: 297mm; display: grid; grid-template-columns: repeat(3, 70mm); grid-template-rows: repeat(8, 37mm);
                background: #fff; color: #000; margin: 0 auto 16px; box-shadow: 0 0 0 1px #ccc; page-break-after: always; overflow: hidden; }
        .et { box-sizing: border-box; padding: 3mm 3mm 2.5mm; display: grid; grid-template-columns: 1fr 22mm; grid-template-rows: auto 1fr auto; gap: 0 2mm; overflow: hidden; font-family: Helvetica, Arial, sans-serif; }
        .et .zona { grid-column: 1; font-weight: 800; font-size: 13pt; line-height: 1.05; text-transform: uppercase; }
        .et .nom { grid-column: 1; font-size: 7.5pt; line-height: 1.15; overflow: hidden; align-self: end; }
        .et .cod { grid-column: 1; font-size: 8.5pt; font-weight: 700; font-family: ui-monospace, monospace; }
        .et .qr { grid-column: 2; grid-row: 1 / 4; width: 22mm; height: 22mm; align-self: center; }
        .et .qr svg { width: 100%; height: 100%; display: block; }
        @media screen { .et { outline: 1px dashed #ddd; outline-offset: -1px; } }
        @page { size: A4; margin: 0; }
        @media print { .hoja { box-shadow: none; margin: 0; } }
      `}</style>
      <div className="no-imprimir" style={{ maxWidth: 720 }}>
        <h1>Etiquetas</h1>
        <p>{etiquetas.length} etiquetas en {hojas.length} {hojas.length === 1 ? "hoja" : "hojas"} A4 de 24 (70 × 37 mm). Imprime al 100 %, sin márgenes ni ajuste a página.</p>
        <form className="fila" method="get">
          <select name="zona" defaultValue={sp.zona ?? ""} aria-label="Zona" style={{ width: 240 }}>
            <option value="">Todas las zonas</option>
            {zonas.map((z) => <option key={z.id} value={z.id}>{z.nombre}</option>)}
          </select>
          <label htmlFor="desde" style={{ margin: 0 }}>Saltar etiquetas ya usadas</label>
          <input id="desde" name="desde" type="number" min={0} max={23} defaultValue={huecos} style={{ width: 80 }} />
          <button>Aplicar</button>
          <Imprimir />
        </form>
      </div>
      {hojas.map((h, i) => (
        <div className="hoja" key={i}>
          {h.map((e, j) => e ? (
            <div className="et" key={j}>
              <div className="zona">{e.zona}</div>
              <div className="nom">{e.nombre}{e.de > 1 ? ` · ${e.n}/${e.de}` : ""}<br />de {e.sala}</div>
              <div className="cod">{e.codigo}</div>
              <div className="qr" dangerouslySetInnerHTML={{ __html: e.qr }} aria-label={`QR de ${e.codigo}`} role="img" />
            </div>
          ) : <div key={j} />)}
        </div>
      ))}
    </>
  );
}
