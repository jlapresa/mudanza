import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { signIn } from "@/auth";
import { usuarioPorToken, inicialDisponible } from "@/lib/acceso";

// Página del enlace personal. Pide pulsar un botón para entrar: así las vistas previas
// de Teams o del correo, que abren el enlace por su cuenta, no inician ninguna sesión.
export default async function Acceso({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ error?: string }> }) {
  const { token } = await params;
  const { error } = await searchParams;
  const u = await usuarioPorToken(token);
  const inicial = !u && (await inicialDisponible(token));

  async function entrar() {
    "use server";
    try {
      await signIn("enlace", { token, redirectTo: "/" });
    } catch (e) {
      if (e instanceof AuthError) redirect(`/acceso/${token}?error=1`);
      throw e;
    }
  }

  const valido = (u || inicial) && !error;
  return (
    <div style={{ maxWidth: 440, margin: "10vh auto" }}>
      <h1>Mudanza Quum</h1>
      {valido ? (
        <form action={entrar}>
          <p>{u ? <>Hola, {u.nombre.split(" ")[0]}. Este es tu enlace personal para entrar.</> : <>Enlace de primera entrada para la persona responsable.</>}</p>
          <p className="sutil">No lo compartas: quien lo tenga entra con tu nombre. Guárdalo para volver a entrar desde otro dispositivo.</p>
          <button className="primario" style={{ width: "100%" }}>Entrar</button>
        </form>
      ) : (
        <>
          <p className="error" role="alert">Este enlace no es válido o ya se ha cambiado.</p>
          <p>Pide un enlace nuevo a quien organiza la mudanza.</p>
        </>
      )}
    </div>
  );
}
