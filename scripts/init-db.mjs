// Inicialización automática de la base de datos (se ejecuta en cada despliegue de Railway).
//  1. Si no existen las tablas, aplica database/schema.sql.
//  2. Si la tabla de usuarios está vacía:
//       - SEED_ON_EMPTY=true  → carga el escenario de demostración (prisma/seed.ts).
//       - SEED_ON_EMPTY=false → crea solo los planes base y el usuario administrador.
//  Nunca borra datos existentes.
import "dotenv/config";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import mariadb from "mariadb";
import bcrypt from "bcryptjs";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

if (!process.env.DATABASE_URL) {
  console.error("✖ Falta la variable DATABASE_URL");
  process.exit(1);
}
const url = new URL(process.env.DATABASE_URL);
const config = {
  host: url.hostname,
  port: Number(url.port || 3306),
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
  database: decodeURIComponent(url.pathname.replace(/^\//, "")),
  allowPublicKeyRetrieval: true,
  multipleStatements: true,
  connectTimeout: 20000,
};

async function conectarConReintentos(intentos = 10) {
  for (let i = 1; i <= intentos; i++) {
    try {
      return await mariadb.createConnection(config);
    } catch (e) {
      console.log(`… esperando MySQL (${i}/${intentos}): ${e.code ?? e.message}`);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
  throw new Error("No fue posible conectar a MySQL");
}

const conn = await conectarConReintentos();
try {
  const [{ total }] = await conn.query(
    "SELECT COUNT(*) AS total FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'usuarios'",
  );
  if (Number(total) === 0) {
    console.log("→ Creando tablas desde database/schema.sql");
    const sql = await readFile(path.join(raiz, "database", "schema.sql"), "utf8");
    await conn.query(sql);
    console.log("✔ Esquema creado");
  } else {
    console.log("✔ Esquema existente detectado");
  }

  const [{ usuarios }] = await conn.query("SELECT COUNT(*) AS usuarios FROM usuarios");
  if (Number(usuarios) === 0) {
    if ((process.env.SEED_ON_EMPTY ?? "true").toLowerCase() !== "false") {
      console.log("→ Base vacía: cargando datos de demostración");
      const r = spawnSync("npx", ["tsx", "prisma/seed.ts"], { cwd: raiz, stdio: "inherit", env: process.env });
      if (r.status !== 0) throw new Error("Falló el seed de demostración");
    } else {
      console.log("→ Base vacía: creando planes base y administrador");
      const hash = await bcrypt.hash(process.env.ADMIN_PASSWORD || "Admin2026*", 10);
      await conn.query(
        "INSERT INTO usuarios (nombre, email, passwordHash, rol, activo, createdAt, updatedAt) VALUES (?, ?, ?, 'ADMINISTRADOR', true, NOW(3), NOW(3))",
        ["Administrador", (process.env.ADMIN_EMAIL || "admin@espartagym.co").toLowerCase(), hash],
      );
      const planes = [
        ["BASE", "Plan Base", "Mensual. Acceso libre a zona de musculación y cardio.", "MENSUAL", 30, 120000, 0, 0, false, false, 0, false, 1, "05:00", "22:00", "1,2,3,4,5,6"],
        ["PRO", "Plan Pro", "Trimestral. Acceso ilimitado, 1 evaluación física y 1 invitado al mes.", "TRIMESTRAL", 90, 320000, 1, 1, false, false, 0, false, 0, "05:00", "22:00", "1,2,3,4,5,6,7"],
        ["ELITE_SEM", "Plan Elite Semestral", "Semestral. Acceso preferencial, valoraciones mensuales, locker asignado, congelamiento hasta 30 días y 2 invitados al mes.", "SEMESTRAL", 180, 580000, 2, 0, true, true, 30, true, 0, "04:30", "23:30", "1,2,3,4,5,6,7"],
        ["ELITE_ANUAL", "Plan Elite Anual", "Anual. Todos los beneficios Elite.", "ANUAL", 365, 1050000, 2, 0, true, true, 30, true, 0, "04:30", "23:30", "1,2,3,4,5,6,7"],
        ["DAY_PASS", "Pase Diario", "Acceso por un día. Se abona si compra una membresía regular en las siguientes 48 horas.", "DIARIO", 1, 25000, 0, 0, false, false, 0, false, 1, "06:00", "21:00", "1,2,3,4,5,6,7"],
      ];
      for (const p of planes) {
        await conn.query(
          `INSERT IGNORE INTO planes (codigo, nombre, descripcion, tipo, duracionDias, precio, invitadosMes, evaluacionesIncluidas, valoracionMensual, lockerIncluido, maxDiasCongelamiento, accesoPreferencial, accesosPorDia, horaInicio, horaFin, diasPermitidos, activo, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, true, NOW(3), NOW(3))`,
          p,
        );
      }
      console.log("✔ Administrador y planes creados");
    }
  } else {
    console.log(`✔ ${usuarios} usuario(s) existentes: no se modifican datos`);
  }
} finally {
  await conn.end();
}
