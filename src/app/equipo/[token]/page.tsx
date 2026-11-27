import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { signIn } from "@/auth";
import { enlaceEquipo, validarRegistro, dominio } from "@/lib/acceso";

// Enlace compartido para que el equipo se registre por su cuenta (rol de equipo).
export default async function Equipo({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ error?: string; email?: string; nombre?: string }> }) {
  const { token } = await params;
  const sp = await searchParams;
  const activo = await enlaceEquipo();

  async function registrar(fd: FormData) {
    "use server";
    const email = String(fd.get("email") ?? "");
    const nombre = String(fd.get("nombre") ?? "");
    const q = (error: string) => `/equipo/${token}?${new URLSearchParams({ error, email, nombre })}`;
    const error = await validarRegistro(token, email, nombre);
    if (error) redirect(q(error));
    try {
      await signIn("equipo", { enlace: token, email, nombre, redirectTo: "/mercadillo" });
    } catch (e) {
      if (e instanceof AuthError) redirect(q("No hemos podido registrarte. Vuelve a intentarlo."));
      throw e;
    }
  }

  if (activo !== token)
    return (
      <div style={{ maxWidth: 440, margin: "10vh auto" }}>
        <h1>Mudanza Quum</h1>
        <p className="error" role="alert">Este enlace ya no es válido.</p>
        <p>Pide uno nuevo a quien organiza la mudanza.</p>
      </div>
    );
  return (
    <div style={{ maxWidth: 440, margin: "8vh auto" }}>
      <h1>Mercadillo de la mudanza</h1>
      <p>Regístrate para ver los muebles que no nos llevamos a la oficina nueva y pedir los que te interesen.</p>
      {sp.error && <p className="error" role="alert">{sp.error}</p>}
      <form action={registrar}>
        <div className="campo"><label htmlFor="nombre">Nombre y apellido</label><input id="nombre" name="nombre" required autoComplete="name" defaultValue={sp.nombre} maxLength={80} /></div>
        <div className="campo"><label htmlFor="email">Correo de Quum</label><input id="email" name="email" type="email" required autoComplete="email" placeholder={`nombre@${dominio()}`} defaultValue={sp.email} /></div>
        <button className="primario" style={{ width: "100%" }}>Entrar</button>
      </form>
      <p className="sutil">Después tendrás un enlace personal en «Tu cuenta» para entrar desde otros dispositivos.</p>
    </div>
  );
}
