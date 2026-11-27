import { redirect } from "next/navigation";
import Link from "next/link";
import { AuthError } from "next-auth";
import { signIn, devLogin } from "@/auth";
import { usuarioActual } from "@/lib/sesion";
import { solicitarCodigo, dominio } from "@/lib/acceso";

type SP = { paso?: string; email?: string; nombre?: string; error?: string; aviso?: string; callbackUrl?: string };

const seguro = (url?: string) => {
  if (!url) return "/";
  try {
    const u = new URL(url, "http://x"); // descarta cualquier otro dominio: solo rutas de la app
    return u.pathname + u.search;
  } catch {
    return "/";
  }
};
const qs = (o: Record<string, string | undefined>) =>
  new URLSearchParams(Object.entries(o).filter(([, v]) => v) as [string, string][]).toString();

export default async function Entrar({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const destino = seguro(sp.callbackUrl);
  if (await usuarioActual()) redirect(destino);

  async function pedirCodigo(fd: FormData) {
    "use server";
    const email = String(fd.get("email") ?? "").trim().toLowerCase();
    const nombre = String(fd.get("nombre") ?? "").trim();
    const error = await solicitarCodigo(email);
    if (error) redirect(`/entrar?${qs({ email, nombre, error, callbackUrl: destino })}`);
    redirect(`/entrar?${qs({ paso: "codigo", email, nombre, callbackUrl: destino })}`);
  }

  async function entrarConCodigo(fd: FormData) {
    "use server";
    const email = String(fd.get("email") ?? "");
    const nombre = String(fd.get("nombre") ?? "");
    try {
      await signIn("codigo", { email, nombre, codigo: String(fd.get("codigo") ?? ""), redirectTo: destino });
    } catch (e) {
      if (e instanceof AuthError)
        redirect(`/entrar?${qs({ paso: "codigo", email, nombre, callbackUrl: destino, error: "El código no es correcto o ha caducado." })}`);
      throw e;
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: "8vh auto" }}>
      <h1>Mudanza Quum</h1>
      {sp.paso !== "codigo" ? (
        <form action={pedirCodigo}>
          <p className="sutil">Entra con tu correo de Quum. Te enviamos un código de seis cifras; si es la primera vez, así quedas registrado.</p>
          {sp.error && <p className="error" role="alert">{sp.error}</p>}
          <div className="campo">
            <label htmlFor="email">Correo de Quum</label>
            <input id="email" name="email" type="email" required autoComplete="email" inputMode="email" placeholder={`nombre@${dominio()}`} defaultValue={sp.email} />
          </div>
          <div className="campo">
            <label htmlFor="nombre">Nombre y apellido <span className="sutil">(solo la primera vez)</span></label>
            <input id="nombre" name="nombre" autoComplete="name" defaultValue={sp.nombre} maxLength={80} />
          </div>
          <button className="primario" style={{ width: "100%" }}>Enviarme el código</button>
        </form>
      ) : (
        <form action={entrarConCodigo}>
          <p>Te hemos enviado un código a <b>{sp.email}</b>. Caduca en 10 minutos.</p>
          {sp.error && <p className="error" role="alert">{sp.error}</p>}
          <input type="hidden" name="email" value={sp.email ?? ""} />
          <input type="hidden" name="nombre" value={sp.nombre ?? ""} />
          <div className="campo">
            <label htmlFor="codigo">Código</label>
            <input id="codigo" name="codigo" required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,7}" maxLength={7} autoFocus
              style={{ fontSize: "1.5rem", letterSpacing: ".3em", textAlign: "center" }} />
          </div>
          <button className="primario" style={{ width: "100%" }}>Entrar</button>
          <p className="sutil" style={{ textAlign: "center" }}>
            <Link href={`/entrar?${qs({ email: sp.email, nombre: sp.nombre, callbackUrl: destino })}`}>Pedir otro código o cambiar de correo</Link>
          </p>
        </form>
      )}

      {devLogin && sp.paso !== "codigo" && (
        <form
          style={{ marginTop: 32, borderTop: "1px solid var(--borde)", paddingTop: 8 }}
          action={async (fd: FormData) => {
            "use server";
            try {
              await signIn("prueba", { email: fd.get("email"), nombre: fd.get("nombre"), rol: fd.get("rol"), redirectTo: destino });
            } catch (e) {
              if (e instanceof AuthError) redirect(`/entrar?${qs({ error: `Solo pueden entrar cuentas de Quum (…@${dominio()}).` })}`);
              throw e;
            }
          }}
        >
          <h2>Acceso de prueba</h2>
          <p className="sutil">Solo en desarrollo: entra sin código y con el rol que elijas.</p>
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
          <button style={{ width: "100%" }}>Entrar sin código</button>
        </form>
      )}
    </div>
  );
}
