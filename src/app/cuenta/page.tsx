import { signOut, signIn } from "@/auth";
import { db } from "@/lib/db";
import { exigirSesion } from "@/lib/sesion";
import { nuevoToken } from "@/lib/acceso";
import { urlBase } from "@/lib/avisos";
import { ROL } from "@/lib/textos";
import Copiar from "@/components/Copiar";

export default async function Cuenta() {
  const u = await exigirSesion();
  const yo = await db.usuario.findUniqueOrThrow({ where: { id: u.id } });
  const enlace = yo.tokenAcceso ? `${urlBase()}/acceso/${yo.tokenAcceso}` : null;

  async function cambiarEnlace() {
    "use server";
    const t = nuevoToken();
    await db.usuario.update({ where: { id: u.id }, data: { tokenAcceso: t } });
    await signIn("enlace", { token: t, redirectTo: "/cuenta" }); // esta sesión sigue; las demás se cierran
  }

  return (
    <div style={{ maxWidth: 560 }}>
      <h1>{u.name}</h1>
      <p>{u.email} · {ROL[u.rol]}</p>
      {enlace && (
        <>
          <h2>Tu enlace personal</h2>
          <p className="sutil">Ábrelo para entrar desde otro dispositivo. No lo compartas: quien lo tenga entra con tu nombre.</p>
          <div className="fila">
            <Copiar texto={enlace} clase="primario" />
            <form action={cambiarEnlace}><button>Cambiar enlace</button></form>
          </div>
          <p className="sutil">Cambiarlo invalida el anterior y cierra la sesión en los demás dispositivos.</p>
        </>
      )}
      <form action={async () => { "use server"; await signOut({ redirectTo: "/entrar" }); }} style={{ marginTop: 24 }}>
        <button>Cerrar sesión</button>
      </form>
    </div>
  );
}
