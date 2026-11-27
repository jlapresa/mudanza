import { db } from "@/lib/db";
import { exigirInventario } from "@/lib/sesion";
import { leerFiltros, whereFiltros, ORDEN_ARTICULOS } from "@/lib/articulos";
import { incluirTarjeta, zonasActivas } from "@/lib/consultas";
import Filtros from "@/components/Filtros";
import ListaConFicha from "@/components/ListaConFicha";

const PAGINA = 48;

export default async function Articulos({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const u = await exigirInventario();
  const sp = await searchParams;
  const f = leerFiltros(sp);
  const n = Math.max(PAGINA, Number(sp.n) || PAGINA);
  const where = whereFiltros(f);
  const [total, articulos] = await Promise.all([
    db.articulo.count({ where }),
    db.articulo.findMany({ where, orderBy: ORDEN_ARTICULOS, include: incluirTarjeta, take: n }),
  ]);
  const qs = new URLSearchParams(Object.entries(sp).filter(([k, v]) => k !== "a" && v));
  const mas = total > n ? (() => { const p = new URLSearchParams(qs); p.set("n", String(n + PAGINA)); return `/articulos?${p}`; })() : null;
  const titulo = f.decision === "pendiente" ? "Sin decidir" : f.foto === "sin" ? "Sin foto" : "Todos los artículos";
  return (
    <>
      <h1>{titulo}</h1>
      <Filtros f={f} zonas={await zonasActivas()} accion="/articulos" />
      <ListaConFicha articulos={articulos} base="/articulos" params={qs} abierto={sp.a} u={u} mostrarSala total={total} mas={mas} />
    </>
  );
}
