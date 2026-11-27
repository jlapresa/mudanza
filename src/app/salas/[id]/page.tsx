import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { exigirInventario } from "@/lib/sesion";
import { leerFiltros, whereFiltros, ORDEN_ARTICULOS } from "@/lib/articulos";
import { incluirTarjeta, zonasActivas } from "@/lib/consultas";
import Filtros from "@/components/Filtros";
import ListaConFicha from "@/components/ListaConFicha";

export default async function Sala({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  const u = await exigirInventario();
  const { id } = await params;
  const sp = await searchParams;
  const sala = await db.salaOrigen.findUnique({ where: { id } });
  if (!sala) notFound();
  const f = { ...leerFiltros(sp), sala: id };
  const articulos = await db.articulo.findMany({ where: whereFiltros(f), orderBy: ORDEN_ARTICULOS, include: incluirTarjeta });
  const qs = new URLSearchParams(Object.entries(sp).filter(([k, v]) => k !== "a" && v));
  return (
    <>
      <p className="sutil" style={{ marginBottom: 0 }}><Link href="/salas">Salas</Link> · {sala.planta}</p>
      <h1>{sala.nombre}</h1>
      <Filtros f={f} zonas={await zonasActivas()} accion={`/salas/${id}`} />
      <ListaConFicha articulos={articulos} base={`/salas/${id}`} params={qs} abierto={sp.a} u={u} total={articulos.length} />
    </>
  );
}
