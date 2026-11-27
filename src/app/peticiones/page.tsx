import Link from "next/link";
import { db } from "@/lib/db";
import { exigirResponsablePagina } from "@/lib/sesion";
import { plazoMercadillo } from "@/lib/ajustes";
import { enMercadillo } from "@/lib/mercadillo";
import { ESTADO_PETICION, fecha } from "@/lib/textos";
import Accion from "@/components/Accion";

export default async function Peticiones() {
  await exigirResponsablePagina();
  const plazo = await plazoMercadillo();
  const articulos = await db.articulo.findMany({
    where: { OR: [enMercadillo, { peticiones: { some: {} } }] },
    orderBy: { codigo: "asc" },
    include: { peticiones: { orderBy: { creadaEn: "asc" }, include: { usuario: true } } },
  });
  const conAbiertas = articulos.filter((a) => a.peticiones.some((p) => p.estado === "abierta"));
  const asignadas = articulos.flatMap((a) => a.peticiones.filter((p) => p.estado === "asignada").map((p) => ({ a, p })));
  const sinPedir = plazo.cerrado
    ? articulos.filter((a) => a.decision === "no_llevar" && a.salida === "ofrecer_equipo" && !a.peticiones.some((p) => ["abierta", "asignada", "recogida"].includes(p.estado)))
    : [];
  return (
    <>
      <h1>Peticiones del equipo</h1>
      <p className="sutil">Regla de Quum: se asigna por orden de llegada. También puedes asignar a una persona concreta desde su fila.</p>
      {conAbiertas.length > 1 && (
        <div style={{ margin: "12px 0" }}>
          {/* Asigna todos los artículos con peticiones abiertas, uno detrás de otro */}
          <form action="/peticiones/asignar-todo" method="post"><button className="primario">Asignar todo por orden de llegada</button></form>
        </div>
      )}

      <h2>Pendientes de asignar ({conAbiertas.length})</h2>
      {!conAbiertas.length && <p className="sutil">No hay peticiones abiertas.</p>}
      {conAbiertas.map((a) => (
        <section key={a.id} className="tarjeta" style={{ padding: 12, marginBottom: 12 }}>
          <div className="fila" style={{ justifyContent: "space-between" }}>
            <Link href={`/a/${a.codigo}`}><b>{a.nombre}</b></Link>
            <span className="sutil">{a.codigo} · {a.cantidad} {a.cantidad === 1 ? "ud." : "uds."}</span>
          </div>
          <ol>
            {a.peticiones.map((p) => (
              <li key={p.id} style={{ margin: "6px 0" }}>
                {p.usuario.nombre} · {p.cantidad} · {fecha(p.creadaEn, true)} · <span className="sutil">{ESTADO_PETICION[p.estado]}</span>
                {p.comentario && <span className="sutil"> · «{p.comentario}»</span>}
                {p.estado === "abierta" && <> <Accion url={`/api/articulos/${a.id}/asignar`} json={{ peticionId: p.id }} texto="Asignar" /></>}
              </li>
            ))}
          </ol>
          <Accion url={`/api/articulos/${a.id}/asignar`} texto="Asignar por orden de llegada" clase="primario" />
        </section>
      ))}

      <h2>Asignadas, por recoger ({asignadas.length})</h2>
      <ul className="lista">
        {asignadas.map(({ a, p }) => (
          <li key={p.id} className="fila" style={{ justifyContent: "space-between" }}>
            <span><Link href={`/a/${a.codigo}`}>{a.nombre}</Link> · {p.usuario.nombre} · {p.cantidad} · antes del {fecha(p.recogidaLimite)}</span>
            <Accion url={`/api/peticiones/${p.id}/recogida`} texto="Recogido" />
          </li>
        ))}
      </ul>

      {plazo.cerrado && (
        <>
          <h2>Nadie lo pidió ({sinPedir.length})</h2>
          <p className="sutil">El mercadillo ha cerrado. Elige otra salida para estos artículos: donar, vender o reciclar.</p>
          <ul className="lista">
            {sinPedir.map((a) => <li key={a.id}><Link href={`/a/${a.codigo}`}>{a.codigo} · {a.nombre}</Link></li>)}
          </ul>
        </>
      )}
    </>
  );
}
