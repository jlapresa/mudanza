import Link from "next/link";
import type { Decision, Salida } from "@prisma/client";
import { etiquetaDecision } from "@/lib/textos";

export type ArticuloTarjeta = {
  codigo: string;
  nombre: string;
  cantidad: number;
  decision: Decision;
  salida: Salida | null;
  medidas?: string | null;
  fotos: { id: string }[];
  zonaDestino: { nombre: string } | null;
  salaOrigen?: { nombre: string; planta: string };
  _count?: { peticiones: number };
};

export function Miniatura({ fotoId, nombre }: { fotoId?: string; nombre: string }) {
  return (
    <div className="miniatura">
      {fotoId ? <img src={`/api/fotos/${fotoId}?mini`} alt={`Foto de ${nombre}`} loading="lazy" decoding="async" /> : <span>Sin foto</span>}
    </div>
  );
}

export default function Tarjeta({ a, href, activo, mostrarSala }: { a: ArticuloTarjeta; href: string; activo?: boolean; mostrarSala?: boolean }) {
  return (
    <Link href={href} className="tarjeta" aria-current={activo ? "true" : undefined} scroll={false}>
      <Miniatura fotoId={a.fotos[0]?.id} nombre={a.nombre} />
      <div className="cuerpo">
        <span className="titulo">{a.nombre}</span>
        <span className="meta">
          {a.codigo} · {a.cantidad} {a.cantidad === 1 ? "ud." : "uds."}
          {mostrarSala && a.salaOrigen ? ` · ${a.salaOrigen.nombre}` : ""}
        </span>
        <span className={`etiqueta ${a.decision}`}>{etiquetaDecision(a.decision, a.salida, a.zonaDestino?.nombre)}</span>
        {!!a._count?.peticiones && <span className="etiqueta info">{a._count.peticiones} {a._count.peticiones === 1 ? "petición" : "peticiones"}</span>}
      </div>
    </Link>
  );
}
