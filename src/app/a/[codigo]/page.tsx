import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { exigirSesion, puedeEditar, esResponsable } from "@/lib/sesion";
import { cargarFicha, zonasActivas } from "@/lib/consultas";
import Ficha from "@/components/Ficha";

// Ficha suelta: es la dirección que llevan los QR de las etiquetas.
export default async function FichaSuelta({ params }: { params: Promise<{ codigo: string }> }) {
  const u = await exigirSesion();
  const { codigo } = await params;
  const a = await cargarFicha(decodeURIComponent(codigo).toUpperCase());
  if (!a) notFound();
  if (!puedeEditar(u)) redirect(`/mercadillo#${a.codigo}`);
  const hermanos = await db.articulo.findMany({ where: { salaOrigenId: a.salaId }, orderBy: [{ posicion: "asc" }, { codigo: "asc" }], select: { codigo: true } });
  const i = hermanos.findIndex((h) => h.codigo === a.codigo);
  return (
    <div style={{ maxWidth: 640, margin: "0 auto" }}>
      <Ficha
        a={a}
        zonas={await zonasActivas()}
        editar
        responsable={esResponsable(u)}
        cerrar={`/salas/${a.salaId}`}
        anterior={i > 0 ? `/a/${hermanos[i - 1].codigo}` : null}
        siguiente={i < hermanos.length - 1 ? `/a/${hermanos[i + 1].codigo}` : null}
        posicion={`${i + 1} de ${hermanos.length} en la sala`}
      />
    </div>
  );
}
