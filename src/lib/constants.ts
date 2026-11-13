// Constantes compartidas entre servidor y cliente (sin dependencias de Prisma).

export const ROLES = ["ADMINISTRADOR", "RECEPCIONISTA", "INSTRUCTOR", "FINANZAS"] as const;
export type RolApp = (typeof ROLES)[number];

export const ROL_LABEL: Record<RolApp, string> = {
  ADMINISTRADOR: "Administrador",
  RECEPCIONISTA: "Recepcionista",
  INSTRUCTOR: "Instructor",
  FINANZAS: "Finanzas",
};

export type EstadoSocioApp = "ACTIVO" | "VENCIDO" | "CONGELADO" | "BLOQUEADO_POR_MORA";

export const ESTADO_LABEL: Record<EstadoSocioApp, string> = {
  ACTIVO: "Activo",
  VENCIDO: "Vencido",
  CONGELADO: "Congelado",
  BLOQUEADO_POR_MORA: "Bloqueado por mora",
};

export const METODOS_PAGO = ["EFECTIVO", "TARJETA", "TRANSFERENCIA"] as const;
export const METODO_LABEL: Record<(typeof METODOS_PAGO)[number], string> = {
  EFECTIVO: "Efectivo",
  TARJETA: "Tarjeta",
  TRANSFERENCIA: "Transferencia",
};

export const TURNOS = ["MANANA", "TARDE", "NOCHE"] as const;
export const TURNO_LABEL: Record<(typeof TURNOS)[number], string> = {
  MANANA: "Mañana",
  TARDE: "Tarde",
  NOCHE: "Noche",
};

export const DIAS_SEMANA = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
export const DIAS_CORTOS = ["L", "M", "X", "J", "V", "S", "D"];

/** Días de gracia tras el inicio de una membresía antes de bloquear por saldo pendiente. */
export const GRACIA_MORA_DIAS = 3;
/** Ventana (en horas) para abonar un pase diario a una membresía regular. */
export const VENTANA_ABONO_DAYPASS_HORAS = 48;
/** Rango del panel de alertas de vencimiento. */
export const ALERTA_VENCIMIENTO_DIAS = 5;
/** Prefijo de los tokens QR (permite distinguir QR de documento en el kiosko). */
export const QR_PREFIX = "GYM-";
/** Cantidad de lockers disponibles para asignar automáticamente. */
export const TOTAL_LOCKERS = 120;

export const GYM_NAME = process.env.NEXT_PUBLIC_GYM_NAME || "Esparta Gym";
