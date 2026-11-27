import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Copiar from "@/components/Copiar";
import { darAcceso, emailPermitido, enlaceEquipo, nuevoToken, regenerarEnlaceEquipo } from "@/lib/acceso";
import { urlBase } from "@/lib/avisos";
import { db } from "@/lib/db";
import { exigirResponsablePagina, usuarioActual, esResponsable } from "@/lib/sesion";
import { leerAjuste, guardarAjuste } from "@/lib/ajustes";
import { registrar } from "@/lib/historial";
import { ROL, fecha } from "@/lib/textos";
import type { Rol } from "@prisma/client";

async function soloResponsable() {
  const u = await usuarioActual();
  if (!esResponsable(u)) throw new Error("Solo el responsable");
  return u!;
}

// Las fechas se guardan en hora de Madrid (+01:00 en diciembre).
const aLocal = (iso: string) => {
  const d = new Date(iso);
  const s = d.toLocaleString("sv-SE", { timeZone: "Europe/Madrid" });
  return s.slice(0, 16).replace(" ", "T");
};

export default async function Ajustes({ searchParams }: { searchParams: Promise<{ malas?: string }> }) {
  const { malas } = await searchParams;
  const base = urlBase();
  const equipo = await enlaceEquipo();
  const yo = await exigirResponsablePagina();
  const [zonas, usuarios, apertura, cierre, recogida] = await Promise.all([
    db.zonaDestino.findMany({ orderBy: { orden: "asc" }, include: { _count: { select: { articulos: true } } } }),
    db.usuario.findMany({ orderBy: [{ rol: "asc" }, { nombre: "asc" }] }),
    leerAjuste("mercadillo_apertura"),
    leerAjuste("mercadillo_cierre"),
    leerAjuste("recogida_dias"),
  ]);

  async function guardarPlazo(fd: FormData) {
    "use server";
    const u = await soloResponsable();
    const zona = (v: string) => new Date(`${v}:00+01:00`).toISOString();
    const ap = zona(String(fd.get("apertura")));
    const ci = zona(String(fd.get("cierre")));
    await guardarAjuste("mercadillo_apertura", ap);
    await guardarAjuste("mercadillo_cierre", ci);
    await guardarAjuste("recogida_dias", String(Math.max(1, Number(fd.get("recogida")) || 7)));
    await registrar(db, { usuarioId: u.id, tipo: "ajuste", campo: "plazo mercadillo", despues: `${ap} → ${ci}` });
    revalidatePath("/", "layout");
  }
  async function nuevaZona(fd: FormData) {
    "use server";
    const u = await soloResponsable();
    const nombre = String(fd.get("nombre") ?? "").trim();
    if (!nombre) return;
    const max = await db.zonaDestino.aggregate({ _max: { orden: true } });
    await db.zonaDestino.upsert({ where: { nombre }, create: { nombre, orden: (max._max.orden ?? 0) + 1 }, update: { activa: true } });
    await registrar(db, { usuarioId: u.id, tipo: "ajuste", campo: "zona", despues: `nueva zona ${nombre}` });
    revalidatePath("/ajustes");
  }
  async function editarZona(fd: FormData) {
    "use server";
    const u = await soloResponsable();
    const id = String(fd.get("id"));
    const nombre = String(fd.get("nombre") ?? "").trim();
    const orden = Number(fd.get("orden")) || 0;
    const activa = fd.get("activa") === "on";
    const antes = await db.zonaDestino.findUniqueOrThrow({ where: { id } });
    await db.zonaDestino.update({ where: { id }, data: { nombre: nombre || antes.nombre, orden, activa } });
    await registrar(db, { usuarioId: u.id, tipo: "ajuste", campo: "zona", antes: `${antes.nombre} (${antes.activa ? "activa" : "inactiva"})`, despues: `${nombre} (${activa ? "activa" : "inactiva"})` });
    revalidatePath("/ajustes");
  }
  async function cambiarRol(fd: FormData) {
    "use server";
    const u = await soloResponsable();
    const id = String(fd.get("id"));
    const rol = String(fd.get("rol")) as Rol;
    if (id === u.id) return; // nadie se quita a sí mismo el rol de responsable
    const antes = await db.usuario.findUniqueOrThrow({ where: { id } });
    await db.usuario.update({ where: { id }, data: { rol } });
    await registrar(db, { usuarioId: u.id, tipo: "ajuste", campo: "rol", antes: `${antes.email}: ${antes.rol}`, despues: `${antes.email}: ${rol}` });
    revalidatePath("/ajustes");
  }
  async function nuevoEnlace(fd: FormData) {
    "use server";
    const u = await soloResponsable();
    const id = String(fd.get("id"));
    if (id === u.id) return; // el propio enlace se cambia desde «Tu cuenta»
    const p = await db.usuario.update({ where: { id }, data: { tokenAcceso: nuevoToken() } });
    await registrar(db, { usuarioId: u.id, tipo: "ajuste", campo: "enlace", despues: `enlace nuevo para ${p.email}` });
    revalidatePath("/ajustes");
  }
  async function alta(fd: FormData) {
    "use server";
    const u = await soloResponsable();
    const rol = String(fd.get("rol")) as Rol;
    // Una persona por línea: «Nombre Apellido; correo@quum.com» o solo el correo.
    const lineas = String(fd.get("personas") ?? "").split(/\n/).map((l) => l.trim()).filter(Boolean);
    const malas: string[] = [];
    for (const l of lineas) {
      const email = l.match(/[^\s;,<>]+@[^\s;,<>]+/)?.[0]?.toLowerCase();
      if (!email || !emailPermitido(email)) { malas.push(l); continue; }
      const nombre = l.replace(email, "").replace(/[;,<>]/g, " ").replace(/\s+/g, " ").trim();
      await darAcceso(email, nombre, rol);
      await registrar(db, { usuarioId: u.id, tipo: "ajuste", campo: "rol", despues: `${email}: ${rol}` });
    }
    revalidatePath("/ajustes");
    if (malas.length) redirect(`/ajustes?malas=${encodeURIComponent(malas.join(" · "))}#personas`);
    redirect("/ajustes#personas");
  }
  async function enlaceDelEquipo(fd: FormData) {
    "use server";
    const u = await soloResponsable();
    if (fd.get("accion") === "desactivar") await guardarAjuste("enlace_equipo_activo", "no");
    else await regenerarEnlaceEquipo();
    await registrar(db, { usuarioId: u.id, tipo: "ajuste", campo: "enlace del equipo", despues: String(fd.get("accion")) });
    revalidatePath("/ajustes");
  }

  return (
    <div style={{ maxWidth: 760 }}>
      <h1>Ajustes</h1>
      <p><Link href="/ajustes/importar">Importar inventario</Link></p>

      <h2>Plazo del mercadillo</h2>
      <form action={guardarPlazo}>
        <div className="fila" style={{ alignItems: "flex-end" }}>
          <div className="campo" style={{ flex: 1, minWidth: 200 }}><label htmlFor="apertura">Apertura</label><input id="apertura" name="apertura" type="datetime-local" defaultValue={aLocal(apertura)} required /></div>
          <div className="campo" style={{ flex: 1, minWidth: 200 }}><label htmlFor="cierre">Cierre</label><input id="cierre" name="cierre" type="datetime-local" defaultValue={aLocal(cierre)} required /></div>
          <div className="campo" style={{ width: 160 }}><label htmlFor="recogida">Días para recoger</label><input id="recogida" name="recogida" type="number" min={1} defaultValue={recogida} /></div>
        </div>
        <button className="primario">Guardar plazo</button>
        <p className="sutil">El día que abre, todo el mundo recibe un aviso en la app, y otro dos días antes del cierre.</p>
      </form>

      <h2>Zonas de destino</h2>
      <table>
        <thead><tr><th>Orden</th><th>Nombre</th><th>Activa</th><th>Artículos</th><th></th></tr></thead>
        <tbody>
          {zonas.map((z) => (
            <tr key={z.id}>
              <td colSpan={5} style={{ padding: 0 }}>
                <form action={editarZona} className="fila" style={{ padding: 6 }}>
                  <input type="hidden" name="id" value={z.id} />
                  <input name="orden" type="number" defaultValue={z.orden} style={{ width: 70 }} aria-label="Orden" />
                  <input name="nombre" defaultValue={z.nombre} style={{ flex: 1, minWidth: 160 }} aria-label="Nombre de la zona" />
                  <label style={{ display: "flex", alignItems: "center", gap: 6, margin: 0 }}><input type="checkbox" name="activa" defaultChecked={z.activa} style={{ width: 22, minHeight: 22 }} /> Activa</label>
                  <span className="sutil">{z._count.articulos}</span>
                  <button>Guardar</button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <form action={nuevaZona} className="fila" style={{ marginTop: 8 }}>
        <input name="nombre" placeholder="Nueva zona" aria-label="Nueva zona" style={{ flex: 1 }} />
        <button>Añadir zona</button>
      </form>

      <h2 id="enlace-equipo">Enlace del equipo</h2>
      <p className="sutil">Un único enlace para todo el personal. Quien lo abre se registra con su nombre y su correo de Quum y entra con rol de equipo: ve el mercadillo y pide. Compártelo en el canal general de Teams.</p>
      {equipo ? (
        <div className="fila">
          <Copiar texto={`${base}/equipo/${equipo}`} clase="primario" />
          <form action={enlaceDelEquipo}><input type="hidden" name="accion" value="nuevo" /><button>Cambiar enlace</button></form>
          <form action={enlaceDelEquipo}><input type="hidden" name="accion" value="desactivar" /><button className="peligro">Desactivar</button></form>
        </div>
      ) : (
        <form action={enlaceDelEquipo}><input type="hidden" name="accion" value="nuevo" /><button className="primario">Crear enlace del equipo</button></form>
      )}

      <h2 id="personas">Personas y enlaces personales</h2>
      <p className="sutil">Cada persona entra con su enlace personal. Copia el de cada una y envíaselo por Teams. Si alguien lo pierde o lo comparte, crea uno nuevo: el anterior deja de valer.</p>
      {malas && <p className="error" role="alert">No se han dado de alta estas líneas porque no llevan un correo de Quum: {malas}</p>}
      <ul className="lista">
        {usuarios.map((us) => (
          <li key={us.id}>
            <div className="fila" style={{ justifyContent: "space-between" }}>
              <span>
                {us.nombre} <span className="sutil">· {us.email}{us.ultimoAcceso ? ` · entró el ${fecha(us.ultimoAcceso, true)}` : " · aún no ha entrado"}</span>
              </span>
              <span className="fila">
                <form action={cambiarRol} className="fila">
                  <input type="hidden" name="id" value={us.id} />
                  <select name="rol" defaultValue={us.rol} aria-label={`Rol de ${us.nombre}`} disabled={us.id === yo.id} style={{ width: 150 }}>
                    {Object.entries(ROL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                  {us.id !== yo.id && <button>Cambiar rol</button>}
                </form>
                {us.tokenAcceso && <Copiar texto={`${base}/acceso/${us.tokenAcceso}`} />}
                {us.id !== yo.id && (
                  <form action={nuevoEnlace}><input type="hidden" name="id" value={us.id} /><button aria-label={`Enlace nuevo para ${us.nombre}`}>{us.tokenAcceso ? "Enlace nuevo" : "Crear enlace"}</button></form>
                )}
              </span>
            </div>
          </li>
        ))}
      </ul>
      <h3>Dar de alta</h3>
      <form action={alta}>
        <div className="campo">
          <label htmlFor="personas-alta">Una persona por línea: nombre y correo de Quum</label>
          <textarea id="personas-alta" name="personas" rows={4} placeholder={"Ana Pérez; ana.perez@quum.com\nLuis Gómez; luis.gomez@quum.com"} required />
        </div>
        <div className="fila">
          <select name="rol" defaultValue="colaborador" aria-label="Rol" style={{ width: 180 }}>
            {Object.entries(ROL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <button className="primario">Dar de alta</button>
        </div>
      </form>
    </div>
  );
}
