import { PrismaClient } from "@/generated/prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

/**
 * Cliente Prisma único (singleton) usando el adaptador MariaDB, compatible con MySQL 8+.
 * La conexión real se abre en la primera consulta, por lo que el build de Next.js
 * no necesita acceso a la base de datos.
 */
function crearCliente() {
  const raw = process.env.DATABASE_URL ?? "mysql://root:root@localhost:3306/gym_access";
  const url = new URL(raw);
  const sslParam = url.searchParams.get("ssl") ?? url.searchParams.get("sslaccept");
  const adapter = new PrismaMariaDb({
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.replace(/^\//, "")),
    connectionLimit: Number(process.env.DB_POOL_SIZE ?? 8),
    // MySQL 8 usa caching_sha2_password: se permite recuperar la llave pública del servidor.
    allowPublicKeyRetrieval: true,
    ...(sslParam ? { ssl: { rejectUnauthorized: false } } : {}),
  });
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as { __prisma?: ReturnType<typeof crearCliente> };

export const prisma = globalForPrisma.__prisma ?? crearCliente();

if (process.env.NODE_ENV !== "production") globalForPrisma.__prisma = prisma;
