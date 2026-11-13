import type { DefaultSession } from "next-auth";
import type { RolApp } from "@/lib/constants";

declare module "next-auth" {
  interface Session {
    user: { id: number; rol: RolApp; nombre: string } & DefaultSession["user"];
  }
  interface User {
    id: string;
    rol: RolApp;
    nombre: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid?: number;
    rol?: RolApp;
    nombre?: string;
  }
}
