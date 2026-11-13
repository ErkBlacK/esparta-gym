import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Valor de respaldo para que `prisma generate` funcione en el build aunque no exista la variable.
    url: process.env.DATABASE_URL ?? "mysql://user:password@localhost:3306/gym_access",
  },
});
