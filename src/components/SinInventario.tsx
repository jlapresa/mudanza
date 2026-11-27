import Link from "next/link";
import { redirect } from "next/navigation";
import { usuarioActual, esResponsable } from "@/lib/sesion";
import { importarIncluido } from "@/lib/inventario-incluido";

/** Aviso cuando todavía no se ha cargado el inventario. El responsable lo carga con un botón. */
export default async function SinInventario() {
  const u = await usuarioActual();
  async function cargar() {
    "use server";
    const yo = await usuarioActual();
    if (!esResponsable(yo)) return;
    await importarIncluido(yo!.id);
    redirect("/salas");
  }
  return (
    <section className="aviso-banda" style={{ padding: 16 }}>
      <h2 style={{ marginTop: 0 }}>Todavía no hay inventario cargado</h2>
      {esResponsable(u) ? (
        <>
          <p>Carga el inventario de la oficina actual: 112 líneas en 17 salas, todas pendientes de decidir.</p>
          <form action={cargar} className="fila">
            <button className="primario">Cargar el inventario</button>
            <Link href="/ajustes/importar" className="boton">Subir otro archivo</Link>
          </form>
        </>
      ) : (
        <p>Cuando la persona responsable lo cargue, aquí aparecerán las salas y sus muebles.</p>
      )}
    </section>
  );
}
