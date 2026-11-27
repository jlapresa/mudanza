import Link from "next/link";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { exigirResponsablePagina, usuarioActual, esResponsable } from "@/lib/sesion";
import { leerAjuste, guardarAjuste } from "@/lib/ajustes";
import { registrar } from "@/lib/historial";
import { ROL } from "@/lib/textos";
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

export default async function Ajustes() {
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
  async function invitar(fd: FormData) {
    "use server";
    const u = await soloResponsable();
    const email = String(fd.get("email") ?? "").trim().toLowerCase();
    const rol = String(fd.get("rol")) as Rol;
    const dominio = (process.env.DOMINIO_PERMITIDO ?? "quum.com").toLowerCase();
    if (!email.endsWith("@" + dominio)) return;
    await db.usuario.upsert({ where: { email }, create: { email, nombre: email.split("@")[0], rol }, update: { rol } });
    await registrar(db, { usuarioId: u.id, tipo: "ajuste", campo: "rol", despues: `${email}: ${rol}` });
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
        <p className="sutil">El correo de apertura sale al abrir y el recordatorio, dos días antes del cierre.</p>
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

      <h2>Personas y roles</h2>
      <p className="sutil">Quien entra por primera vez tiene rol de equipo. Aquí se asigna el de responsable o colaborador.</p>
      <ul className="lista">
        {usuarios.map((us) => (
          <li key={us.id}>
            <form action={cambiarRol} className="fila" style={{ justifyContent: "space-between" }}>
              <span>{us.nombre} <span className="sutil">· {us.email}</span></span>
              <input type="hidden" name="id" value={us.id} />
              <span className="fila">
                <select name="rol" defaultValue={us.rol} aria-label={`Rol de ${us.nombre}`} disabled={us.id === yo.id} style={{ width: 160 }}>
                  {Object.entries(ROL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                {us.id !== yo.id && <button>Cambiar</button>}
              </span>
            </form>
          </li>
        ))}
      </ul>
      <form action={invitar} className="fila" style={{ marginTop: 8 }}>
        <input name="email" type="email" placeholder="nombre@quum.com" aria-label="Correo" style={{ flex: 1, minWidth: 200 }} required />
        <select name="rol" defaultValue="colaborador" aria-label="Rol" style={{ width: 160 }}>
          {Object.entries(ROL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <button>Dar acceso</button>
      </form>
    </div>
  );
}
