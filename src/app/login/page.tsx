import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { GYM_NAME } from "@/lib/constants";
import { Marca } from "@/components/shell";
import { Suspense } from "react";
import { LoginForm } from "./login-form";

export const metadata = { title: "Iniciar sesión" };

export default async function LoginPage() {
  const session = await getServerSession(authOptions);
  if (session) redirect("/dashboard");
  return (
    <main className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden overflow-hidden border-r border-line bg-surface lg:block">
        <div className="absolute inset-0 opacity-[0.35] [background-image:linear-gradient(rgb(var(--line))_1px,transparent_1px),linear-gradient(90deg,rgb(var(--line))_1px,transparent_1px)] [background-size:44px_44px]" />
        <div className="relative flex h-full flex-col justify-between p-12">
          <div className="flex items-center gap-3">
            <Marca tam={32} />
            <span className="text-sm font-semibold tracking-tight">{GYM_NAME}</span>
          </div>
          <div className="max-w-md">
            <div className="mb-6 grid grid-cols-3 gap-2">
              {[
                ["Permitido", "bg-ok", "Torniquete liberado"],
                ["Congelado", "bg-warn", "Hasta 24/11"],
                ["Denegado", "bg-bad", "Saldo pendiente"],
              ].map(([t, c, d]) => (
                <div key={t} className="rounded-xl border border-line bg-bg/70 p-3 backdrop-blur">
                  <span className={`mb-3 block h-1.5 w-6 rounded-full ${c}`} />
                  <div className="text-xs font-medium">{t}</div>
                  <div className="mt-0.5 text-2xs text-subtle">{d}</div>
                </div>
              ))}
            </div>
            <h1 className="text-3xl font-semibold leading-tight tracking-tight">
              Acceso, membresías y caja
              <br />
              <span className="text-muted">en un solo lugar.</span>
            </h1>
            <p className="mt-4 text-[13px] leading-relaxed text-muted">
              Validación por documento o QR en menos de un segundo, congelamientos que recalculan vencimientos, pases de cortesía, cierres de caja por turno y reportes gerenciales.
            </p>
          </div>
          <div className="font-mono text-2xs text-subtle">v1.0 · Next.js · Prisma · MySQL</div>
        </div>
      </section>
      <section className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm animate-fade-in">
          <div className="mb-8 lg:hidden">
            <Marca tam={36} />
          </div>
          <h2 className="text-xl font-semibold tracking-tight">Inicia sesión</h2>
          <p className="mt-1 text-[13px] text-muted">Usa tu cuenta de personal del gimnasio.</p>
          <Suspense fallback={null}><LoginForm /></Suspense>
          <div className="mt-8 rounded-xl border border-dashed border-line p-4 text-2xs leading-relaxed text-muted">
            <div className="mb-1.5 font-medium text-fg">Cuentas de demostración</div>
            <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 font-mono">
              <span>admin@forjagym.co</span><span className="text-subtle">Admin2026*</span>
              <span>recepcion@forjagym.co</span><span className="text-subtle">Recepcion2026*</span>
              <span>instructor@forjagym.co</span><span className="text-subtle">Instructor2026*</span>
              <span>finanzas@forjagym.co</span><span className="text-subtle">Finanzas2026*</span>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
