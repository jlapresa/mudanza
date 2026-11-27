import type { Categoria, Decision, Estado, EstadoPeticion, Salida, Rol } from "@prisma/client";

export const DECISION: Record<Decision, string> = {
  pendiente: "Pendiente",
  llevar: "Se lleva",
  no_llevar: "No se lleva",
};
export const SALIDA: Record<Salida, string> = {
  ofrecer_equipo: "Ofrecer al equipo",
  vender: "Vender",
  donar: "Donar",
  reciclar: "Reciclar",
  dejar_en_local: "Se queda en el local",
  devolver: "Devolver",
};
export const CATEGORIA: Record<Categoria, string> = {
  silla: "Silla",
  mesa: "Mesa",
  armario: "Armario",
  estanteria: "Estantería",
  sofa: "Sofá o butaca",
  electronica: "Electrónica",
  decoracion: "Decoración",
  otros: "Otros",
};
export const ESTADO: Record<Estado, string> = {
  bueno: "Bueno",
  aceptable: "Aceptable",
  deteriorado: "Deteriorado",
};
export const ESTADO_PETICION: Record<EstadoPeticion, string> = {
  abierta: "Abierta",
  asignada: "Asignada",
  rechazada: "No asignada",
  retirada: "Retirada",
  recogida: "Recogida",
};
export const ROL: Record<Rol, string> = {
  responsable: "Responsable",
  colaborador: "Colaborador",
  equipo: "Equipo",
};
export const CAMPO: Record<string, string> = {
  decision: "Decisión",
  zonaDestino: "Zona de destino",
  salida: "Salida",
  notasDecision: "Notas",
  nombre: "Nombre",
  descripcion: "Descripción",
  categoria: "Categoría",
  medidas: "Medidas",
  estado: "Estado",
  cantidad: "Cantidad",
};

export function etiquetaDecision(d: Decision, salida?: Salida | null, zona?: string | null) {
  if (d === "llevar") return zona ? `Se lleva · ${zona}` : "Se lleva";
  if (d === "no_llevar") return salida ? `No se lleva · ${SALIDA[salida]}` : "No se lleva";
  return "Pendiente";
}

export function fecha(d: Date | string | null | undefined, conHora = false) {
  if (!d) return "";
  const x = typeof d === "string" ? new Date(d) : d;
  return x.toLocaleString("es-ES", {
    day: "numeric",
    month: "short",
    ...(conHora ? { hour: "2-digit", minute: "2-digit" } : { year: "numeric" }),
    timeZone: "Europe/Madrid",
  });
}

export function plural(n: number, uno: string, varios: string) {
  return `${n} ${n === 1 ? uno : varios}`;
}
