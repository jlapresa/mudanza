import { redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { exigirResponsablePagina, usuarioActual, esResponsable } from "@/lib/sesion";
import { interpretar, leerDocx, resumen, guardarInventario } from "@/lib/importacion";
import { guardar, leer } from "@/lib/almacen";

// Importación del inventario en Word desde la app, con vista previa antes de guardar.
const CLAVE = "importacion/pendiente.docx";

export default async function Importar({ searchParams }: { searchParams: Promise<{ paso?: string; hecho?: string; error?: string }> }) {
  await exigirResponsablePagina();
  const sp = await searchParams;
  const total = await db.articulo.count({ where: { origenClave: { not: null } } });

  async function subir(fd: FormData) {
    "use server";
    if (!esResponsable(await usuarioActual())) return;
    const f = fd.get("archivo");
    if (!(f instanceof File) || !f.name.toLowerCase().endsWith(".docx")) redirect("/ajustes/importar?error=1");
    await guardar(CLAVE, Buffer.from(await f.arrayBuffer()), "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    await db.ajuste.upsert({ where: { clave: "importacion_archivo" }, create: { clave: "importacion_archivo", valor: f.name }, update: { valor: f.name } });
    redirect("/ajustes/importar?paso=vista");
  }
  async function confirmar() {
    "use server";
    const u = await usuarioActual();
    if (!esResponsable(u)) return;
    const buf = await leer(CLAVE);
    if (!buf) redirect("/ajustes/importar?error=1");
    const nombre = (await db.ajuste.findUnique({ where: { clave: "importacion_archivo" } }))?.valor ?? "inventario.docx";
    const r = await guardarInventario(db, interpretar(await leerDocx(buf)).lineas, nombre, u!.id);
    redirect(`/ajustes/importar?hecho=${r.nuevos}-${r.existentes}-${r.total}`);
  }

  let vista: React.ReactNode = null;
  if (sp.paso === "vista") {
    const buf = await leer(CLAVE);
    if (buf) {
      const { lineas, desconocidos } = interpretar(await leerDocx(buf));
      const { salas, unidades } = resumen(lineas);
      const conAviso = lineas.filter((l) => l.avisos.length);
      vista = (
        <>
          <h2>Vista previa</h2>
          <p><b>{lineas.length} líneas</b>, {unidades} unidades, {salas.size} salas.</p>
          <table>
            <thead><tr><th>Planta</th><th>Sala</th><th>Líneas</th><th>Unidades</th></tr></thead>
            <tbody>{[...salas.values()].map((s) => <tr key={s.planta + s.sala}><td>{s.planta}</td><td>{s.sala}</td><td>{s.lineas}</td><td>{s.unidades}</td></tr>)}</tbody>
          </table>
          {desconocidos.length > 0 && <p className="aviso-banda">Estos párrafos no están dentro de ninguna sala conocida y no se importan: {desconocidos.join(" · ")}</p>}
          {conAviso.length > 0 && (
            <details><summary>{conAviso.length} líneas para revisar después</summary>
              <ul className="lista">{conAviso.map((l) => <li key={l.clave} className="sutil">{l.sala} · «{l.original.trim()}»: {l.avisos.join("; ")}</li>)}</ul>
            </details>
          )}
          <p className="sutil">Las líneas que ya están en la app no se tocan. Todo lo nuevo entra como pendiente.</p>
          <form action={confirmar}><button className="primario">Importar</button></form>
        </>
      );
    }
  }

  const [nuevos, existentes, tot] = (sp.hecho ?? "").split("-");
  return (
    <div style={{ maxWidth: 760 }}>
      <p className="sutil" style={{ marginBottom: 0 }}><Link href="/ajustes">Ajustes</Link></p>
      <h1>Importar inventario</h1>
      <p>Ahora hay {total} líneas del inventario en la app.</p>
      {sp.hecho && <p className="ok-banda" role="status">Importadas {nuevos} líneas nuevas; {existentes} ya estaban. Total en la app: {tot}.</p>}
      {sp.error && <p className="error" role="alert">Sube el inventario en formato Word (.docx).</p>}
      <form action={subir}>
        <div className="campo"><label htmlFor="archivo">Archivo de inventario (.docx)</label><input id="archivo" name="archivo" type="file" accept=".docx" required /></div>
        <button>Ver vista previa</button>
      </form>
      {vista}
    </div>
  );
}
