import { createHash, randomBytes, timingSafeEqual } from "crypto";
import type { Rol } from "@prisma/client";
import { db } from "./db";
import { leerAjuste, guardarAjuste } from "./ajustes";

// Acceso sin correo:
// - Cada persona tiene un enlace personal (/acceso/<token>) que le pasa el responsable.
// - Un enlace del equipo (/equipo/<token>), compartido, deja registrarse con rol de equipo.
// - El enlace inicial (ACCESO_INICIAL) solo sirve para la primera entrada de los responsables.

export const dominio = () => (process.env.DOMINIO_PERMITIDO ?? "quum.com").toLowerCase();
export const emailPermitido = (email?: string | null) =>
  !!email && /^[a-z0-9._%+-]+@[a-z0-9.-]+$/.test(email.toLowerCase()) && email.toLowerCase().endsWith("@" + dominio());

export const nuevoToken = () => randomBytes(24).toString("base64url");
/** Huella corta del token, guardada en la sesión: si el token cambia, la sesión deja de valer. */
export const huella = (token: string | null | undefined) => (token ? createHash("sha256").update(token).digest("hex").slice(0, 16) : "");

const iguales = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};
const valido = (t: string) => /^[A-Za-z0-9_-]{20,64}$/.test(t);

export async function usuarioPorToken(token: string) {
  if (!valido(token)) return null;
  return db.usuario.findFirst({ where: { tokenAcceso: token } });
}

const responsablesIniciales = () => (process.env.RESPONSABLES ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);

/** El enlace inicial vale mientras algún responsable de RESPONSABLES no tenga enlace personal. */
export async function inicialDisponible(token: string) {
  const inicial = process.env.ACCESO_INICIAL;
  if (!inicial || !valido(token) || !iguales(token, inicial)) return false;
  const conEnlace = await db.usuario.count({ where: { email: { in: responsablesIniciales() }, tokenAcceso: { not: null } } });
  return conEnlace < responsablesIniciales().length;
}

/** Primera entrada de un responsable con el enlace inicial, mientras no tenga enlace personal. */
export async function entradaInicial(token: string) {
  if (!(await inicialDisponible(token))) return null;
  for (const email of responsablesIniciales()) {
    const u = await db.usuario.findUnique({ where: { email } });
    if (u?.tokenAcceso) continue;
    const t = nuevoToken();
    return u
      ? db.usuario.update({ where: { id: u.id }, data: { rol: "responsable", tokenAcceso: t } })
      : db.usuario.create({ data: { email, nombre: nombreDesdeEmail(email), rol: "responsable", tokenAcceso: t } });
  }
  return null;
}

export const nombreDesdeEmail = (email: string) =>
  email.split("@")[0].split(/[._-]+/).filter(Boolean).map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(" ");

export async function enlaceEquipo(): Promise<string | null> {
  const t = await leerAjuste("enlace_equipo");
  return t && (await leerAjuste("enlace_equipo_activo")) !== "no" ? t : null;
}
export async function regenerarEnlaceEquipo() {
  const t = nuevoToken();
  await guardarAjuste("enlace_equipo", t);
  await guardarAjuste("enlace_equipo_activo", "si");
  return t;
}

/** Comprueba un registro con el enlace del equipo. Devuelve un mensaje de error o null. */
export async function validarRegistro(enlace: string, emailBruto: string, nombreBruto: string): Promise<string | null> {
  const activo = await enlaceEquipo();
  if (!activo || !valido(enlace) || !iguales(enlace, activo)) return "Este enlace ya no es válido. Pide uno nuevo a quien organiza la mudanza.";
  const email = emailBruto.trim().toLowerCase();
  if (!emailPermitido(email)) return `Usa tu correo de Quum (…@${dominio()}).`;
  if (nombreBruto.trim().length < 2) return "Escribe tu nombre y apellido.";
  if (await db.usuario.findUnique({ where: { email } }))
    return "Ya hay una cuenta con ese correo. Entra con tu enlace personal o pídeselo a quien organiza la mudanza.";
  return null;
}

/** Registro con el enlace del equipo. Devuelve el usuario o un mensaje de error. */
export async function registrarConEnlaceEquipo(enlace: string, emailBruto: string, nombreBruto: string) {
  const error = await validarRegistro(enlace, emailBruto, nombreBruto);
  if (error) return error;
  return db.usuario.create({
    data: { email: emailBruto.trim().toLowerCase(), nombre: nombreBruto.trim().slice(0, 80), rol: "equipo", tokenAcceso: nuevoToken() },
  });
}

/** Alta o cambio desde Ajustes. Da enlace personal si no lo tiene. */
export async function darAcceso(email: string, nombre: string, rol: Rol) {
  const e = email.trim().toLowerCase();
  const n = nombre.trim().slice(0, 80) || nombreDesdeEmail(e);
  const ya = await db.usuario.findUnique({ where: { email: e } });
  if (ya) return db.usuario.update({ where: { id: ya.id }, data: { rol, nombre: nombre.trim() ? n : ya.nombre, tokenAcceso: ya.tokenAcceso ?? nuevoToken() } });
  return db.usuario.create({ data: { email: e, nombre: n, rol, tokenAcceso: nuevoToken() } });
}
