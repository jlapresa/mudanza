import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { signIn, devLogin } from "@/auth";
import { usuarioActual } from "@/lib/sesion";
import { dominio } from "@/lib/acceso";

export default async function Entrar({ searchParams }: { searchParams: Promise<{ error?: string; callbackUrl?: string }> }) {
  const sp = await searchParams;
  if (await usuarioActual()) {
    const u = new URL(sp.callbackUrl || "/", "http://x"); // solo rutas de la app
    redirect(u.pathname + u.search);
  }
  return (
    <div style={{ maxWidth: 440, margin: "10vh auto" }}>
      <h1>Mudanza Quum</h1>
      <p>Para entrar necesitas tu enlace personal. Si no lo tienes, pídeselo a quien organiza la mudanza.</p>
      <p className="sutil">Si ya entraste antes desde otro dispositivo, tu enlace está en «Tu cuenta».</p>
      {sp.error && <p className="error" role="alert">{sp.error}</p>}

      {devLogin && (
        <form
          style={{ marginTop: 32, borderTop: "1px solid var(--borde)", paddingTop: 8 }}
          action={async (fd: FormData) => {
            "use server";
            try {
              await signIn("prueba", { email: fd.get("email"), nombre: fd.get("nombre"), rol: fd.get("rol"), redirectTo: "/" });
            } catch (e) {
              if (e instanceof AuthError) redirect(`/entrar?error=${encodeURIComponent(`Solo pueden entrar cuentas de Quum (…@${dominio()}).`)}`);
              throw e;
            }
          }}
        >
          <h2>Acceso de prueba</h2>
          <p className="sutil">Solo en desarrollo: entra sin enlace y con el rol que elijas.</p>
          <div className="campo"><label htmlFor="p-email">Correo</label><input id="p-email" name="email" type="email" required /></div>
          <div className="campo"><label htmlFor="p-nombre">Nombre</label><input id="p-nombre" name="nombre" /></div>
          <div className="campo">
            <label htmlFor="p-rol">Rol</label>
            <select id="p-rol" name="rol" defaultValue="equipo">
              <option value="responsable">Responsable</option>
              <option value="colaborador">Colaborador</option>
              <option value="equipo">Equipo</option>
            </select>
          </div>
          <button style={{ width: "100%" }}>Entrar sin enlace</button>
        </form>
      )}
    </div>
  );
}
