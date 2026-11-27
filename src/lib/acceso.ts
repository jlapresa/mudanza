import { createHash, randomInt } from "crypto";
import { db } from "./db";
import { enviarCorreo } from "./correo";

export const dominio = () => (process.env.DOMINIO_PERMITIDO ?? "quum.com").toLowerCase();
export const emailPermitido = (email?: string | null) => !!email && /^[^\s@]+@[^\s@]+$/.test(email) && email.toLowerCase().endsWith("@" + dominio());

const MINUTOS = 10;
const MAX_INTENTOS = 5;
const MAX_POR_HORA = 5;

const resumen = (email: string, codigo: string) =>
  createHash("sha256").update(`${email}:${codigo}:${process.env.AUTH_SECRET}`).digest("hex");

/** Envía un código de 6 cifras al correo. Devuelve un mensaje de error o null. */
export async function solicitarCodigo(emailBruto: string): Promise<string | null> {
  const email = emailBruto.trim().toLowerCase();
  if (!emailPermitido(email)) return `Usa tu correo de Quum (…@${dominio()}).`;
  const recientes = await db.codigoAcceso.count({ where: { email, creadoEn: { gt: new Date(Date.now() - 3600_000) } } });
  if (recientes >= MAX_POR_HORA) return "Has pedido demasiados códigos. Espera un rato y vuelve a intentarlo.";
  const codigo = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await db.codigoAcceso.create({ data: { email, hash: resumen(email, codigo), expira: new Date(Date.now() + MINUTOS * 60_000) } });
  try {
    await enviarCorreo(
      [email],
      `Tu código para entrar: ${codigo}`,
      `Tu código para entrar en Mudanza Quum es ${codigo}.\n\nCaduca en ${MINUTOS} minutos. Si no lo has pedido tú, ignora este correo.`,
      { registrar: false },
    );
  } catch {
    return "No hemos podido enviarte el código. Vuelve a intentarlo en un momento.";
  }
  return null;
}

/** Comprueba el código. Solo vale el último enviado, una vez y durante 10 minutos. */
export async function comprobarCodigo(emailBruto: string, codigoBruto: string): Promise<boolean> {
  const email = emailBruto.trim().toLowerCase();
  const codigo = codigoBruto.replace(/\D/g, "");
  if (!emailPermitido(email) || codigo.length !== 6) return false;
  const c = await db.codigoAcceso.findFirst({ where: { email }, orderBy: { creadoEn: "desc" } });
  if (!c || c.usado || c.expira < new Date() || c.intentos >= MAX_INTENTOS) return false;
  if (c.hash !== resumen(email, codigo)) {
    await db.codigoAcceso.update({ where: { id: c.id }, data: { intentos: { increment: 1 } } });
    return false;
  }
  await db.codigoAcceso.update({ where: { id: c.id }, data: { usado: true } });
  return true;
}
