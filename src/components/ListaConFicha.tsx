import Tarjeta, { type ArticuloTarjeta } from "./Tarjeta";
import Ficha from "./Ficha";
import { cargarFicha, zonasActivas } from "@/lib/consultas";
import type { Usuario } from "@/lib/sesion";
import { esResponsable, puedeEditar } from "@/lib/sesion";

/** Lista de tarjetas con la ficha abierta en panel (escritorio) o a pantalla completa (móvil). */
export default async function ListaConFicha({
  articulos, base, params, abierto, u, mostrarSala, total, mas,
}: {
  articulos: ArticuloTarjeta[];
  base: string;
  params: URLSearchParams;
  abierto?: string;
  u: Usuario;
  mostrarSala?: boolean;
  total?: number;
  mas?: string | null;
}) {
  const href = (codigo?: string | null) => {
    const p = new URLSearchParams(params);
    if (codigo) p.set("a", codigo);
    else p.delete("a");
    const s = p.toString();
    return s ? `${base}?${s}` : base;
  };
  const i = abierto ? articulos.findIndex((a) => a.codigo === abierto) : -1;
  const ficha = abierto ? await cargarFicha(abierto) : null;
  const zonas = ficha ? await zonasActivas() : [];
  return (
    <div className={`con-panel ${ficha ? "abierto" : ""}`}>
      <div>
        {total !== undefined && <p className="sutil">{total} {total === 1 ? "artículo" : "artículos"}</p>}
        {!articulos.length && <p>No hay artículos con estos filtros.</p>}
        <div className="rejilla">
          {articulos.map((a) => (
            <Tarjeta key={a.codigo} a={a} href={href(a.codigo)} activo={a.codigo === abierto} mostrarSala={mostrarSala} />
          ))}
        </div>
        {mas && <div className="paginacion"><a className="boton" href={mas}>Ver más</a></div>}
      </div>
      {ficha && (
        <aside className="panel-ficha" aria-label="Ficha del artículo">
          <Ficha
            a={ficha}
            zonas={zonas}
            editar={puedeEditar(u)}
            responsable={esResponsable(u)}
            cerrar={href(null)}
            anterior={i > 0 ? href(articulos[i - 1].codigo) : null}
            siguiente={i >= 0 && i < articulos.length - 1 ? href(articulos[i + 1].codigo) : null}
            posicion={i >= 0 ? `${i + 1} de ${articulos.length}` : undefined}
          />
        </aside>
      )}
    </div>
  );
}
