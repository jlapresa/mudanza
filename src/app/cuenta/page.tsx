import { signOut } from "@/auth";
import { exigirSesion } from "@/lib/sesion";
import { ROL } from "@/lib/textos";

export default async function Cuenta() {
  const u = await exigirSesion();
  return (
    <div style={{ maxWidth: 480 }}>
      <h1>{u.name}</h1>
      <p>{u.email}</p>
      <p>Rol: {ROL[u.rol]}</p>
      <form action={async () => { "use server"; await signOut({ redirectTo: "/entrar" }); }}>
        <button>Cerrar sesión</button>
      </form>
    </div>
  );
}
