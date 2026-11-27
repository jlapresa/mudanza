import Link from "next/link";
import { db } from "@/lib/db";
import { exigirSesion } from "@/lib/sesion";
import { fecha } from "@/lib/textos";
import MarcarLeidos from "./MarcarLeidos";

export default async function Avisos() {
  const u = await exigirSesion();
  const avisos = await db.aviso.findMany({ where: { usuarioId: u.id }, orderBy: { creadoEn: "desc" }, take: 100 });
  return (
    <>
      <h1>Avisos</h1>
      {!avisos.length && <p>No tienes avisos.</p>}
      <ul className="lista">
        {avisos.map((a) => (
          <li key={a.id} style={{ fontWeight: a.leido ? 400 : 600 }}>
            {a.enlace ? <Link href={a.enlace}>{a.texto}</Link> : a.texto}
            <div className="sutil">{fecha(a.creadoEn, true)}</div>
          </li>
        ))}
      </ul>
      {avisos.some((a) => !a.leido) && <MarcarLeidos />}
    </>
  );
}
