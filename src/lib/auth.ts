import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import type { RolApp } from "./constants";
import { puede, type Accion } from "./permisos";

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt", maxAge: 60 * 60 * 12 },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "Credenciales",
      credentials: {
        email: { label: "Correo", type: "email" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email?.trim().toLowerCase();
        const password = credentials?.password ?? "";
        if (!email || !password) return null;
        const usuario = await prisma.usuario.findUnique({ where: { email } });
        if (!usuario || !usuario.activo) return null;
        const valido = await bcrypt.compare(password, usuario.passwordHash);
        if (!valido) return null;
        return { id: String(usuario.id), email: usuario.email, name: usuario.nombre, nombre: usuario.nombre, rol: usuario.rol as RolApp };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.uid = Number(user.id);
        token.rol = user.rol;
        token.nombre = user.nombre;
      }
      return token;
    },
    async session({ session, token }) {
      session.user = {
        ...session.user,
        id: token.uid ?? 0,
        rol: (token.rol ?? "RECEPCIONISTA") as RolApp,
        nombre: token.nombre ?? session.user?.name ?? "",
      };
      return session;
    },
  },
};

export type UsuarioSesion = { id: number; rol: RolApp; nombre: string; email: string };

/** Sesión actual o redirección al login (para Server Components). */
export async function requerirSesion(): Promise<UsuarioSesion> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  return { id: session.user.id, rol: session.user.rol, nombre: session.user.nombre, email: session.user.email ?? "" };
}

export class ErrorPermiso extends Error {
  constructor(msg = "No tienes permisos para realizar esta acción.") {
    super(msg);
  }
}

/** Sesión con permiso para una acción (para Server Actions). Lanza ErrorPermiso. */
export async function requerirPermiso(accion: Accion): Promise<UsuarioSesion> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new ErrorPermiso("Tu sesión expiró. Vuelve a iniciar sesión.");
  if (!puede(session.user.rol, accion)) throw new ErrorPermiso();
  return { id: session.user.id, rol: session.user.rol, nombre: session.user.nombre, email: session.user.email ?? "" };
}
