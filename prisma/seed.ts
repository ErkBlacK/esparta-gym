/**
 * Datos semilla de demostración.
 * Ejecuta:  npm run db:seed   (BORRA los datos existentes y carga el escenario demo)
 *
 * El escenario se genera relativo a la fecha actual para que siempre existan
 * socios activos, vencidos, congelados, bloqueados por mora y próximos a vencer.
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { hoy, sumarDias, inicioDelDia, diaSemanaISO } from "../src/lib/fechas";

const url = new URL(process.env.DATABASE_URL ?? "mysql://root:root@localhost:3306/gym_access");
const prisma = new PrismaClient({
  adapter: new PrismaMariaDb({
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.replace(/^\//, "")),
    connectionLimit: 4,
    allowPublicKeyRetrieval: true,
  }),
});

// Generador pseudoaleatorio determinista (mismo escenario en cada ejecución).
let semilla = 20261112;
function rnd() {
  semilla |= 0;
  semilla = (semilla + 0x6d2b79f5) | 0;
  let t = Math.imul(semilla ^ (semilla >>> 15), 1 | semilla);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const entre = (a: number, b: number) => Math.floor(rnd() * (b - a + 1)) + a;
const elegir = <T,>(arr: T[]): T => arr[Math.floor(rnd() * arr.length)]!;

const D = hoy();
const ahora = new Date();
/** Instante local: fecha "solo día" + hora local. */
const en = (fecha: Date, h: number, m = 0) => new Date(inicioDelDia(fecha).getTime() + (h * 60 + m) * 60000);
const qr = () => "GYM-" + randomBytes(12).toString("hex").toUpperCase();
const turnoDe = (d: Date): "MANANA" | "TARDE" | "NOCHE" => {
  const h = Number(new Intl.DateTimeFormat("en-US", { hour: "2-digit", hourCycle: "h23", timeZone: process.env.APP_TIMEZONE || "America/Bogota" }).format(d));
  return h < 13 ? "MANANA" : h < 21 ? "TARDE" : "NOCHE";
};

async function limpiar() {
  await prisma.evaluacionFisica.deleteMany();
  await prisma.reserva.deleteMany();
  await prisma.claseGrupal.deleteMany();
  await prisma.acceso.deleteMany();
  await prisma.pago.deleteMany();
  await prisma.cajaTurno.deleteMany();
  await prisma.invitado.deleteMany();
  await prisma.congelamiento.deleteMany();
  await prisma.membresia.updateMany({ data: { abonoDayPassId: null } });
  await prisma.membresia.deleteMany();
  await prisma.socio.deleteMany();
  await prisma.plan.deleteMany();
  await prisma.usuario.deleteMany();
}

async function main() {
  console.log("→ Limpiando tablas…");
  await limpiar();

  console.log("→ Usuarios y roles");
  const usuariosData = [
    { nombre: "Laura Méndez", email: "admin@espartagym.co", password: "Admin2026*", rol: "ADMINISTRADOR" as const },
    { nombre: "Andrés Rojas", email: "recepcion@espartagym.co", password: "Recepcion2026*", rol: "RECEPCIONISTA" as const },
    { nombre: "Valentina Cruz", email: "recepcion2@espartagym.co", password: "Recepcion2026*", rol: "RECEPCIONISTA" as const },
    { nombre: "Camila Torres", email: "instructor@espartagym.co", password: "Instructor2026*", rol: "INSTRUCTOR" as const },
    { nombre: "Julián Pardo", email: "instructor2@espartagym.co", password: "Instructor2026*", rol: "INSTRUCTOR" as const },
    { nombre: "Sofía Herrera", email: "finanzas@espartagym.co", password: "Finanzas2026*", rol: "FINANZAS" as const },
  ];
  const usuarios: Record<string, number> = {};
  for (const u of usuariosData) {
    const creado = await prisma.usuario.create({
      data: { nombre: u.nombre, email: u.email, rol: u.rol, passwordHash: await bcrypt.hash(u.password, 10) },
    });
    usuarios[u.email] = creado.id;
  }
  const recep1 = usuarios["recepcion@espartagym.co"]!;
  const recep2 = usuarios["recepcion2@espartagym.co"]!;
  const instr1 = usuarios["instructor@espartagym.co"]!;
  const instr2 = usuarios["instructor2@espartagym.co"]!;

  console.log("→ Planes base");
  const planesData = [
    {
      codigo: "BASE",
      nombre: "Plan Base",
      descripcion: "Mensual. Acceso libre a zona de musculación y cardio.",
      tipo: "MENSUAL" as const,
      duracionDias: 30,
      precio: 120000,
      accesosPorDia: 1,
      horaInicio: "05:00",
      horaFin: "22:00",
      diasPermitidos: "1,2,3,4,5,6",
    },
    {
      codigo: "PRO",
      nombre: "Plan Pro",
      descripcion: "Trimestral. Acceso ilimitado, 1 evaluación física y 1 invitado al mes.",
      tipo: "TRIMESTRAL" as const,
      duracionDias: 90,
      precio: 320000,
      invitadosMes: 1,
      evaluacionesIncluidas: 1,
      accesosPorDia: 0,
      horaInicio: "05:00",
      horaFin: "22:00",
      diasPermitidos: "1,2,3,4,5,6,7",
    },
    {
      codigo: "ELITE_SEM",
      nombre: "Plan Elite Semestral",
      descripcion: "Semestral. Acceso preferencial, valoraciones mensuales, locker asignado, congelamiento hasta 30 días y 2 invitados al mes.",
      tipo: "SEMESTRAL" as const,
      duracionDias: 180,
      precio: 580000,
      invitadosMes: 2,
      valoracionMensual: true,
      lockerIncluido: true,
      maxDiasCongelamiento: 30,
      accesoPreferencial: true,
      accesosPorDia: 0,
      horaInicio: "04:30",
      horaFin: "23:30",
      diasPermitidos: "1,2,3,4,5,6,7",
    },
    {
      codigo: "ELITE_ANUAL",
      nombre: "Plan Elite Anual",
      descripcion: "Anual. Todos los beneficios Elite: acceso preferencial, valoraciones mensuales, locker, congelamiento hasta 30 días y 2 invitados al mes.",
      tipo: "ANUAL" as const,
      duracionDias: 365,
      precio: 1050000,
      invitadosMes: 2,
      valoracionMensual: true,
      lockerIncluido: true,
      maxDiasCongelamiento: 30,
      accesoPreferencial: true,
      accesosPorDia: 0,
      horaInicio: "04:30",
      horaFin: "23:30",
      diasPermitidos: "1,2,3,4,5,6,7",
    },
    {
      codigo: "DAY_PASS",
      nombre: "Pase Diario",
      descripcion: "Acceso por un día para particulares. Su valor se abona si compra una membresía regular en las siguientes 48 horas.",
      tipo: "DIARIO" as const,
      duracionDias: 1,
      precio: 25000,
      accesosPorDia: 1,
      horaInicio: "06:00",
      horaFin: "21:00",
      diasPermitidos: "1,2,3,4,5,6,7",
    },
  ];
  const planes: Record<string, { id: number; precio: number; duracion: number; tipo: string; locker: boolean }> = {};
  for (const p of planesData) {
    const creado = await prisma.plan.create({ data: p });
    planes[p.codigo] = { id: creado.id, precio: p.precio, duracion: p.duracionDias, tipo: p.tipo, locker: !!p.lockerIncluido };
  }

  console.log("→ Socios");
  const nombres = [
    ["Santiago", "Ramírez Gómez", "M"], ["Valeria", "Castro Rincón", "F"], ["Mateo", "López Arango", "M"], ["Isabella", "Martínez Peña", "F"],
    ["Sebastián", "Rodríguez Vela", "M"], ["Mariana", "García Ospina", "F"], ["Nicolás", "Hernández Ruiz", "M"], ["Gabriela", "Moreno Salas", "F"],
    ["Samuel", "Jiménez Cárdenas", "M"], ["Daniela", "Vargas Quintero", "F"], ["Alejandro", "Muñoz Restrepo", "M"], ["Luciana", "Rojas Beltrán", "F"],
    ["Tomás", "Díaz Galindo", "M"], ["Sara", "Torres Molina", "F"], ["Emiliano", "Suárez Patiño", "M"], ["Antonella", "Gutiérrez Mejía", "F"],
    ["Martín", "Pérez Londoño", "M"], ["Salomé", "Sánchez Duque", "F"], ["Jerónimo", "Romero Acosta", "M"], ["Manuela", "Álvarez Ríos", "F"],
    ["Juan José", "Castillo Niño", "M"], ["Emilia", "Ortiz Bermúdez", "F"], ["David", "Ruiz Cifuentes", "M"], ["Victoria", "Navarro Pineda", "F"],
    ["Felipe", "Mendoza Tovar", "M"], ["Paula", "Guerrero Lozano", "F"], ["Andrés", "Cortés Zapata", "M"], ["Laura", "Parra Villamil", "F"],
    ["Diego", "Medina Franco", "M"], ["Camila", "Aguilar Pacheco", "F"], ["Esteban", "Rincón Barrera", "M"], ["Natalia", "Silva Cuervo", "F"],
    ["Ricardo", "Prieto Lara", "M"], ["Juliana", "Cano Henao", "F"], ["Óscar", "Vega Forero", "M"], ["Carolina", "Bernal Rubio", "F"],
    ["Miguel", "Salazar Ocampo", "M"], ["Ana María", "Fajardo León", "F"],
  ];
  const medicas = [null, null, null, "Hipertensión controlada. Evitar cargas máximas.", "Lesión antigua de rodilla derecha.", null, "Asma leve: porta inhalador.", null];
  const socios: { id: number; nombre: string }[] = [];
  for (let i = 0; i < nombres.length; i++) {
    const [n, a, g] = nombres[i]!;
    const nac = new Date(Date.UTC(entre(1975, 2006), entre(0, 11), entre(1, 28)));
    const s = await prisma.socio.create({
      data: {
        tipoDocumento: i % 13 === 7 ? "CE" : "CC",
        documento: String(1000000000 + entre(10000000, 99999999) + i),
        nombres: n!,
        apellidos: a!,
        genero: g === "M" ? "Masculino" : "Femenino",
        fechaNacimiento: nac,
        email: `${n!.toLowerCase().replace(/\s|á|é|í|ó|ú/g, (c) => ({ á: "a", é: "e", í: "i", ó: "o", ú: "u" } as Record<string, string>)[c] ?? "")}.${a!.split(" ")[0]!.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")}@correo.co`,
        telefono: `3${entre(0, 2)}${entre(0, 9)}${entre(1000000, 9999999)}`,
        direccion: `Calle ${entre(1, 170)} # ${entre(1, 99)}-${entre(1, 99)}, Bogotá`,
        contactoEmergenciaNombre: elegir(["María", "José", "Luz", "Carlos", "Ana", "Jorge"]) + " " + a!.split(" ")[0],
        contactoEmergenciaTelefono: `3${entre(0, 2)}${entre(0, 9)}${entre(1000000, 9999999)}`,
        contactoEmergenciaParentesco: elegir(["Madre", "Padre", "Pareja", "Hermano(a)", "Amigo(a)"]),
        observacionesMedicas: elegir(medicas),
        qrToken: qr(),
        createdAt: en(sumarDias(D, -entre(60, 400)), 10),
      },
    });
    socios.push({ id: s.id, nombre: `${n} ${a}` });
  }
  // Documento fácil de recordar para la demostración del kiosko
  await prisma.socio.update({ where: { id: socios[0]!.id }, data: { documento: "1010101010" } });
  await prisma.socio.update({ where: { id: socios[18]!.id }, data: { documento: "2020202020" } }); // vencido
  await prisma.socio.update({ where: { id: socios[23]!.id }, data: { documento: "3030303030" } }); // mora
  await prisma.socio.update({ where: { id: socios[26]!.id }, data: { documento: "4040404040" } }); // congelado

  console.log("→ Membresías, pagos y congelamientos");
  const pagos: { socioId: number; membresiaId: number; monto: number; metodo: "EFECTIVO" | "TARJETA" | "TRANSFERENCIA"; concepto: "MEMBRESIA" | "ABONO"; fecha: Date; usuarioId: number }[] = [];
  let siguienteLocker = 1;

  async function membresia(
    socioIdx: number,
    codigo: string,
    inicio: Date,
    opciones: { pagado?: number; descuento?: number; abonoDe?: number; venta?: Date; abonoTardio?: number } = {},
  ) {
    const plan = planes[codigo]!;
    const fin = sumarDias(inicio, plan.duracion - 1);
    const descuento = opciones.descuento ?? 0;
    const montoTotal = plan.precio - descuento;
    const venta = opciones.venta ?? en(inicio <= D ? inicio : D, entre(6, 19), entre(0, 59));
    const ventaReal = venta > ahora ? new Date(ahora.getTime() - 3600_000) : venta;
    const vendedor = elegir([recep1, recep2]);
    const m = await prisma.membresia.create({
      data: {
        socioId: socios[socioIdx]!.id,
        planId: plan.id,
        fechaInicio: inicio,
        fechaFin: fin,
        fechaFinAjustada: fin,
        precioLista: plan.precio,
        descuento,
        montoTotal,
        abonoDayPassId: opciones.abonoDe ?? null,
        vendidaPorId: vendedor,
        notas: descuento > 0 ? "Abono de pase diario aplicado" : null,
        createdAt: ventaReal,
      },
    });
    const pagado = opciones.pagado ?? montoTotal;
    if (pagado > 0) {
      pagos.push({
        socioId: socios[socioIdx]!.id,
        membresiaId: m.id,
        monto: pagado,
        metodo: elegir(["EFECTIVO", "TARJETA", "TARJETA", "TRANSFERENCIA"]),
        concepto: "MEMBRESIA",
        fecha: ventaReal,
        usuarioId: vendedor,
      });
    }
    if (plan.locker && fin >= D) {
      await prisma.socio.update({ where: { id: socios[socioIdx]!.id }, data: { lockerNumero: siguienteLocker++ } });
    }
    return m;
  }

  // Historial: membresías anteriores ya terminadas (para ingresos y "más vendidas").
  for (let i = 0; i < socios.length; i++) {
    if (i % 3 === 0) continue;
    const codigo = elegir(["BASE", "BASE", "BASE", "PRO", "PRO", "ELITE_SEM"]);
    const dur = planes[codigo]!.duracion;
    const inicio = sumarDias(D, -dur - entre(35, 80));
    if (codigo === "ELITE_SEM") continue; // evitar lockers en historial
    await membresia(i, codigo, inicio);
  }

  // 0–11: activos con distintos planes y días restantes
  await membresia(0, "PRO", sumarDias(D, -20));
  await membresia(1, "BASE", sumarDias(D, -10));
  await membresia(2, "ELITE_ANUAL", sumarDias(D, -120));
  await membresia(3, "BASE", sumarDias(D, -5));
  await membresia(4, "PRO", sumarDias(D, -45));
  await membresia(5, "ELITE_SEM", sumarDias(D, -30));
  await membresia(6, "BASE", sumarDias(D, -15));
  await membresia(7, "PRO", sumarDias(D, -60));
  await membresia(8, "BASE", sumarDias(D, -2));
  await membresia(9, "ELITE_SEM", sumarDias(D, -90));
  await membresia(10, "PRO", sumarDias(D, -8));
  await membresia(11, "BASE", sumarDias(D, -20));
  // 12–16: próximos a vencer (1 a 5 días)
  await membresia(12, "BASE", sumarDias(D, -29)); // vence hoy
  await membresia(13, "BASE", sumarDias(D, -28)); // 2 días
  await membresia(14, "PRO", sumarDias(D, -87)); // 3 días
  await membresia(15, "BASE", sumarDias(D, -26)); // 4 días
  await membresia(16, "PRO", sumarDias(D, -85)); // 5 días
  // 17: activo con renovación futura ya pagada
  await membresia(17, "BASE", sumarDias(D, -27));
  await membresia(17, "BASE", sumarDias(D, 3), { venta: en(sumarDias(D, -1), 18, 10) });
  // 18–22: vencidos
  await membresia(18, "BASE", sumarDias(D, -32));
  await membresia(19, "BASE", sumarDias(D, -45));
  await membresia(20, "PRO", sumarDias(D, -100));
  await membresia(21, "BASE", sumarDias(D, -70));
  await membresia(22, "PRO", sumarDias(D, -130));
  // 23–25: bloqueados por mora (saldo pendiente fuera del periodo de gracia)
  await membresia(23, "PRO", sumarDias(D, -12), { pagado: 150000 });
  await membresia(24, "BASE", sumarDias(D, -9), { pagado: 60000 });
  await membresia(25, "ELITE_SEM", sumarDias(D, -20), { pagado: 300000 });
  // 26–28: congelados (Elite)
  const cong1 = await membresia(26, "ELITE_SEM", sumarDias(D, -60));
  const cong2 = await membresia(27, "ELITE_ANUAL", sumarDias(D, -200));
  const cong3 = await membresia(28, "ELITE_SEM", sumarDias(D, -40));
  for (const [m, ini, dias] of [
    [cong1, -3, 15],
    [cong2, -10, 20],
    [cong3, 0, 10],
  ] as const) {
    const fi = sumarDias(D, ini);
    const ff = sumarDias(fi, dias - 1);
    await prisma.congelamiento.create({
      data: { membresiaId: m.id, fechaInicio: fi, fechaFin: ff, dias, motivo: elegir(["Viaje de trabajo", "Incapacidad médica", "Vacaciones"]), creadoPorId: recep1, createdAt: en(sumarDias(fi, -1), 11) },
    });
    await prisma.membresia.update({ where: { id: m.id }, data: { diasCongelados: dias, fechaFinAjustada: sumarDias(m.fechaFinAjustada, dias) } });
  }
  // Congelamiento histórico ya cumplido en un Elite activo
  {
    const m5 = await prisma.membresia.findFirst({ where: { socioId: socios[9]!.id, plan: { codigo: "ELITE_SEM" } }, orderBy: { id: "desc" } });
    if (m5) {
      await prisma.congelamiento.create({
        data: { membresiaId: m5.id, fechaInicio: sumarDias(D, -50), fechaFin: sumarDias(D, -41), dias: 10, motivo: "Viaje familiar", creadoPorId: recep2, createdAt: en(sumarDias(D, -51), 9) },
      });
      await prisma.membresia.update({ where: { id: m5.id }, data: { diasCongelados: 10, fechaFinAjustada: sumarDias(m5.fechaFinAjustada, 10) } });
    }
  }
  // 29–30: saldo pendiente dentro del periodo de gracia (aún activos)
  await membresia(29, "PRO", sumarDias(D, -1), { pagado: 200000 });
  await membresia(30, "BASE", sumarDias(D, 0), { pagado: 50000 });
  // 31–32: pases diarios hoy
  await membresia(31, "DAY_PASS", D);
  await membresia(32, "DAY_PASS", D);
  // 33: pase diario ayer → elegible para abono (ventana de 48 h)
  await membresia(33, "DAY_PASS", sumarDias(D, -1), { venta: en(sumarDias(D, -1), 17, 30) });
  // 34: pase diario de hace 2 semanas que SÍ se abonó a un Plan Base
  const dp = await membresia(34, "DAY_PASS", sumarDias(D, -14), { venta: en(sumarDias(D, -14), 8, 0) });
  await membresia(34, "BASE", sumarDias(D, -13), { descuento: 25000, abonoDe: dp.id, venta: en(sumarDias(D, -13), 9, 15) });
  // 35–37: más activos
  await membresia(35, "ELITE_ANUAL", sumarDias(D, -15));
  await membresia(36, "BASE", sumarDias(D, -3));
  await membresia(37, "PRO", sumarDias(D, -30));

  // Abonos posteriores parciales en socios con mora (para mostrar historial)
  const mora = await prisma.membresia.findFirst({ where: { socioId: socios[25]!.id }, orderBy: { id: "desc" } });
  if (mora) pagos.push({ socioId: socios[25]!.id, membresiaId: mora.id, monto: 100000, metodo: "TRANSFERENCIA", concepto: "ABONO", fecha: en(sumarDias(D, -6), 12, 40), usuarioId: recep2 });

  console.log("→ Cajas por turno");
  // Agrupa pagos por día y turno → crea cajas cerradas (y la caja de hoy abierta).
  const grupos = new Map<string, typeof pagos>();
  for (const p of pagos) {
    const clave = `${hoy(p.fecha).toISOString().slice(0, 10)}|${turnoDe(p.fecha)}`;
    if (!grupos.has(clave)) grupos.set(clave, []);
    grupos.get(clave)!.push(p);
  }
  for (const [clave, lista] of grupos) {
    const [fechaStr, turno] = clave.split("|") as [string, "MANANA" | "TARDE" | "NOCHE"];
    const fecha = new Date(fechaStr + "T00:00:00Z");
    const esHoy = fecha.getTime() === D.getTime();
    const usuarioId = turno === "MANANA" ? recep1 : recep2;
    const tot = { EFECTIVO: 0, TARJETA: 0, TRANSFERENCIA: 0 };
    for (const p of lista) tot[p.metodo] += p.monto;
    const apertura = en(fecha, turno === "MANANA" ? 5 : turno === "TARDE" ? 13 : 21, 0);
    const montoInicial = 200000;
    const descuadre = elegir([0, 0, 0, 0, -2000, 1000]);
    const caja = await prisma.cajaTurno.create({
      data: {
        usuarioId: esHoy ? recep1 : usuarioId,
        turno,
        apertura: apertura > ahora ? new Date(ahora.getTime() - 4 * 3600_000) : apertura,
        montoInicial,
        estado: esHoy ? "ABIERTA" : "CERRADA",
        cierre: esHoy ? null : en(fecha, turno === "MANANA" ? 13 : turno === "TARDE" ? 21 : 23, 30),
        totalEfectivo: esHoy ? 0 : tot.EFECTIVO,
        totalTarjeta: esHoy ? 0 : tot.TARJETA,
        totalTransferencia: esHoy ? 0 : tot.TRANSFERENCIA,
        efectivoContado: esHoy ? null : montoInicial + tot.EFECTIVO + descuadre,
        diferencia: esHoy ? null : descuadre,
        observaciones: esHoy ? null : descuadre !== 0 ? "Diferencia menor registrada en arqueo" : "Cuadre sin novedad",
      },
    });
    // Solo puede haber una caja abierta por usuario: las de hoy se fusionan en la primera abierta.
    await prisma.pago.createMany({
      data: lista.map((p) => ({ ...p, cajaId: caja.id, usuarioId: esHoy ? recep1 : p.usuarioId })),
    });
  }
  // Consolidar cajas abiertas de hoy en una sola
  const abiertas = await prisma.cajaTurno.findMany({ where: { estado: "ABIERTA" }, orderBy: { apertura: "asc" } });
  if (abiertas.length > 1) {
    const principal = abiertas[0]!;
    for (const c of abiertas.slice(1)) {
      await prisma.pago.updateMany({ where: { cajaId: c.id }, data: { cajaId: principal.id } });
      await prisma.cajaTurno.delete({ where: { id: c.id } });
    }
  }

  console.log("→ Bitácora de accesos (últimos 30 días)");
  const membresiasTodas = await prisma.membresia.findMany({ include: { plan: true } });
  const congelamientos = await prisma.congelamiento.findMany();
  const accesos: { socioId: number; valorIngresado: string; metodo: "QR" | "DOCUMENTO"; resultado: "PERMITIDO" | "DENEGADO"; motivo: string | null; fecha: Date; usuarioId: number }[] = [];
  const sociosDb = await prisma.socio.findMany();
  const horasPico = [5, 6, 6, 7, 7, 8, 9, 10, 12, 12, 16, 17, 17, 18, 18, 18, 19, 19, 20, 21];
  for (let off = -30; off <= 0; off++) {
    const dia = sumarDias(D, off);
    for (const s of sociosDb) {
      const m = membresiasTodas.find((x) => x.socioId === s.id && x.fechaInicio <= dia && dia <= x.fechaFinAjustada);
      if (!m) continue;
      const cong = congelamientos.some((c) => c.membresiaId === m.id && c.fechaInicio <= dia && dia <= c.fechaFin);
      if (cong) continue;
      if (!m.plan.diasPermitidos.split(",").includes(String(diaSemanaISO(dia)))) continue;
      if (rnd() > (m.plan.tipo === "DIARIO" ? 1 : 0.55)) continue;
      let h = elegir(horasPico);
      const hi = Number(m.plan.horaInicio.slice(0, 2));
      const hf = Number(m.plan.horaFin.slice(0, 2));
      h = Math.min(Math.max(h, hi), hf - 1);
      const fecha = en(dia, h, entre(0, 59));
      if (fecha > ahora) continue;
      accesos.push({ socioId: s.id, valorIngresado: rnd() > 0.4 ? s.qrToken : s.documento, metodo: rnd() > 0.4 ? "QR" : "DOCUMENTO", resultado: "PERMITIDO", motivo: "Torniquete liberado", fecha, usuarioId: elegir([recep1, recep2]) });
    }
  }
  // Intentos denegados representativos
  const denegados = [
    [18, "Membresía vencida"], [19, "Membresía vencida"], [23, "Saldo pendiente"], [24, "Saldo pendiente"], [26, "Membresía congelada"], [21, "Membresía vencida"],
  ] as const;
  for (let k = 0; k < 18; k++) {
    const [idx, motivo] = elegir([...denegados]);
    const s = sociosDb.find((x) => x.id === socios[idx]!.id)!;
    const fecha = en(sumarDias(D, -entre(0, 20)), elegir(horasPico), entre(0, 59));
    if (fecha > ahora) continue;
    accesos.push({ socioId: s.id, valorIngresado: s.documento, metodo: "DOCUMENTO", resultado: "DENEGADO", motivo, fecha, usuarioId: recep1 });
  }
  await prisma.acceso.createMany({ data: accesos });
  await prisma.acceso.createMany({
    data: [
      { valorIngresado: "79845123", metodo: "DOCUMENTO", resultado: "DENEGADO", motivo: "Documento no registrado en el sistema", fecha: en(sumarDias(D, -2), 18, 12), usuarioId: recep2 },
      { valorIngresado: "1033445566", metodo: "DOCUMENTO", resultado: "DENEGADO", motivo: "Fuera de horario permitido (Lun a Sáb 05:00–22:00)", fecha: en(sumarDias(D, -5), 22, 40), usuarioId: recep2 },
    ],
  });

  console.log("→ Invitados del mes");
  const conInvitados = [
    [0, "Laura Ramírez", "52123987"],
    [2, "Felipe Arango", "80456123"],
    [5, "Carolina Peña", "1019876543"],
  ] as const;
  for (const [idx, nombre, doc] of conInvitados) {
    const m = membresiasTodas.find((x) => x.socioId === socios[idx]!.id && x.fechaInicio <= D && D <= x.fechaFinAjustada);
    if (!m) continue;
    const fecha = en(D.getUTCDate() > 3 ? sumarDias(D, -2) : D, 18, 20);
    await prisma.invitado.create({ data: { socioId: socios[idx]!.id, membresiaId: m.id, nombre, documento: doc, fecha: fecha > ahora ? new Date(ahora.getTime() - 60000) : fecha, registradoPorId: recep1 } });
    await prisma.acceso.create({ data: { socioId: socios[idx]!.id, valorIngresado: doc, metodo: "DOCUMENTO", tipo: "INVITADO", resultado: "PERMITIDO", motivo: `Invitado: ${nombre}`, fecha: fecha > ahora ? new Date(ahora.getTime() - 60000) : fecha, usuarioId: recep1 } });
  }

  console.log("→ Clases grupales y reservas");
  const clases = [
    { nombre: "Spinning Amanecer", disciplina: "Spinning", instructorId: instr1, dias: [1, 3, 5], horaInicio: "06:00", horaFin: "06:50", aforoMax: 20, sala: "Sala Ciclo" },
    { nombre: "Spinning After Office", disciplina: "Spinning", instructorId: instr1, dias: [2, 4], horaInicio: "18:30", horaFin: "19:20", aforoMax: 20, sala: "Sala Ciclo" },
    { nombre: "Yoga Flow", disciplina: "Yoga", instructorId: instr1, dias: [2, 4, 6], horaInicio: "07:00", horaFin: "08:00", aforoMax: 15, sala: "Estudio Zen" },
    { nombre: "Crossfit WOD", disciplina: "Crossfit", instructorId: instr2, dias: [1, 2, 3, 4, 5], horaInicio: "18:00", horaFin: "19:00", aforoMax: 12, sala: "Box Funcional" },
    { nombre: "Crossfit Weekend", disciplina: "Crossfit", instructorId: instr2, dias: [6], horaInicio: "09:00", horaFin: "10:00", aforoMax: 14, sala: "Box Funcional" },
    { nombre: "Pilates Mat", disciplina: "Pilates", instructorId: instr1, dias: [1, 3], horaInicio: "19:30", horaFin: "20:20", aforoMax: 10, sala: "Estudio Zen" },
  ];
  const activosIdx = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 35, 36, 37];
  for (const c of clases) {
    for (const dia of c.dias) {
      const clase = await prisma.claseGrupal.create({
        data: { nombre: c.nombre, disciplina: c.disciplina, instructorId: c.instructorId, diaSemana: dia, horaInicio: c.horaInicio, horaFin: c.horaFin, aforoMax: c.aforoMax, sala: c.sala },
      });
      // próxima sesión (0–6 días)
      const delta = (dia - diaSemanaISO(D) + 7) % 7;
      const sesion = sumarDias(D, delta);
      const cupos = Math.min(c.aforoMax, entre(3, c.aforoMax));
      const elegidos = [...activosIdx].sort(() => rnd() - 0.5).slice(0, cupos);
      await prisma.reserva.createMany({ data: elegidos.map((idx) => ({ claseId: clase.id, socioId: socios[idx]!.id, fecha: sesion, estado: "CONFIRMADA" as const })) });
      // sesión anterior con asistencias
      const anterior = sumarDias(sesion, -7);
      const prev = [...activosIdx].sort(() => rnd() - 0.5).slice(0, entre(3, c.aforoMax));
      await prisma.reserva.createMany({ data: prev.map((idx) => ({ claseId: clase.id, socioId: socios[idx]!.id, fecha: anterior, estado: rnd() > 0.15 ? ("ASISTIO" as const) : ("CANCELADA" as const) })) });
    }
  }

  console.log("→ Evaluaciones físicas");
  for (const idx of [0, 2, 5, 9, 4]) {
    await prisma.evaluacionFisica.create({
      data: {
        socioId: socios[idx]!.id,
        instructorId: elegir([instr1, instr2]),
        fecha: en(sumarDias(D, -entre(3, 18)), 9, 30),
        pesoKg: entre(55, 95) + 0.5,
        estaturaCm: entre(155, 190),
        grasaCorporal: entre(12, 30) + 0.4,
        masaMuscular: entre(28, 45) + 0.2,
        notas: elegir(["Buen progreso en fuerza. Mantener rutina 4x semana.", "Enfocar trabajo de movilidad de cadera.", "Aumentar volumen de cardio zona 2."]),
      },
    });
  }

  console.log("→ Sincronizando estados");
  // Estado calculado (misma lógica que el motor de reglas)
  const { evaluarEstado } = await import("../src/lib/reglas");
  const todos = await prisma.socio.findMany({
    include: { membresias: { where: { estado: "ACTIVA" }, include: { plan: true, pagos: { select: { monto: true } }, congelamientos: true } } },
  });
  for (const s of todos) {
    const ev = evaluarEstado(s.membresias as never, D);
    await prisma.socio.update({ where: { id: s.id }, data: { estado: ev.estado } });
  }

  const resumen = await prisma.socio.groupBy({ by: ["estado"], _count: true });
  console.log("✔ Seed completado:", resumen.map((r) => `${r.estado}=${r._count}`).join(", "));
  console.log("  Usuarios: admin@espartagym.co / Admin2026*  ·  recepcion@espartagym.co / Recepcion2026*");
  console.log("            instructor@espartagym.co / Instructor2026*  ·  finanzas@espartagym.co / Finanzas2026*");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
