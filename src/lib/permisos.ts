import type { RolApp } from "./constants";

// Matriz de permisos por módulo. Es la única fuente de verdad: la usan el
// middleware (rutas), el menú lateral y las acciones del servidor.

const TODOS: RolApp[] = ["ADMINISTRADOR", "RECEPCIONISTA", "INSTRUCTOR", "FINANZAS"];

export type Modulo = {
  href: string;
  label: string;
  grupo: "General" | "Operación" | "Gestión";
  roles: RolApp[];
};

export const MODULOS: Modulo[] = [
  { href: "/dashboard", label: "Resumen", grupo: "General", roles: TODOS },
  { href: "/kiosko", label: "Kiosko de acceso", grupo: "General", roles: ["ADMINISTRADOR", "RECEPCIONISTA"] },
  { href: "/socios", label: "Socios", grupo: "Operación", roles: ["ADMINISTRADOR", "RECEPCIONISTA", "INSTRUCTOR"] },
  { href: "/operaciones", label: "Congelamientos e invitados", grupo: "Operación", roles: ["ADMINISTRADOR", "RECEPCIONISTA"] },
  { href: "/accesos", label: "Bitácora de accesos", grupo: "Operación", roles: ["ADMINISTRADOR", "RECEPCIONISTA"] },
  { href: "/clases", label: "Clases y reservas", grupo: "Operación", roles: ["ADMINISTRADOR", "RECEPCIONISTA", "INSTRUCTOR"] },
  { href: "/finanzas", label: "Caja y pagos", grupo: "Gestión", roles: ["ADMINISTRADOR", "RECEPCIONISTA", "FINANZAS"] },
  { href: "/reportes", label: "Reportes", grupo: "Gestión", roles: ["ADMINISTRADOR", "FINANZAS"] },
  { href: "/planes", label: "Planes", grupo: "Gestión", roles: ["ADMINISTRADOR", "RECEPCIONISTA", "FINANZAS"] },
  { href: "/usuarios", label: "Usuarios y roles", grupo: "Gestión", roles: ["ADMINISTRADOR"] },
];

/** Permisos de acciones específicas (escrituras). */
export const ACCIONES = {
  gestionarSocios: ["ADMINISTRADOR", "RECEPCIONISTA"],
  venderMembresia: ["ADMINISTRADOR", "RECEPCIONISTA"],
  registrarPago: ["ADMINISTRADOR", "RECEPCIONISTA", "FINANZAS"],
  operarCaja: ["ADMINISTRADOR", "RECEPCIONISTA", "FINANZAS"],
  congelar: ["ADMINISTRADOR", "RECEPCIONISTA"],
  invitados: ["ADMINISTRADOR", "RECEPCIONISTA"],
  validarAcceso: ["ADMINISTRADOR", "RECEPCIONISTA"],
  evaluaciones: ["ADMINISTRADOR", "INSTRUCTOR"],
  gestionarClases: ["ADMINISTRADOR"],
  reservar: ["ADMINISTRADOR", "RECEPCIONISTA", "INSTRUCTOR"],
  editarPlanes: ["ADMINISTRADOR"],
  gestionarUsuarios: ["ADMINISTRADOR"],
  verFinanzas: ["ADMINISTRADOR", "FINANZAS"],
  exportar: ["ADMINISTRADOR", "FINANZAS"],
} satisfies Record<string, RolApp[]>;

export type Accion = keyof typeof ACCIONES;

export function puede(rol: RolApp | undefined, accion: Accion): boolean {
  return !!rol && (ACCIONES[accion] as RolApp[]).includes(rol);
}

export function moduloDeRuta(pathname: string): Modulo | undefined {
  return MODULOS.find((m) => pathname === m.href || pathname.startsWith(m.href + "/"));
}

export function puedeVerRuta(rol: RolApp | undefined, pathname: string): boolean {
  const modulo = moduloDeRuta(pathname);
  if (!modulo) return true;
  return !!rol && modulo.roles.includes(rol);
}
