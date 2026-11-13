import { requerirSesion } from "@/lib/auth";
import { MODULOS } from "@/lib/permisos";
import { GYM_NAME, ROL_LABEL } from "@/lib/constants";
import { BotonSalir, MenuMovil, Sidebar, ThemeToggle } from "@/components/shell";
import { Avatar } from "@/components/ui";
import { formatoFechaLarga, hoy } from "@/lib/fechas";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const usuario = await requerirSesion();
  const modulos = MODULOS.filter((m) => m.roles.includes(usuario.rol));
  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 border-r border-line bg-bg px-3 py-5 lg:block">
        <Sidebar modulos={modulos} gym={GYM_NAME} />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-line bg-bg/80 px-4 backdrop-blur-md sm:px-8">
          <div className="flex items-center gap-3">
            <MenuMovil modulos={modulos} gym={GYM_NAME} />
            <span className="hidden font-mono text-2xs uppercase tracking-[0.14em] text-subtle sm:inline">{formatoFechaLarga(hoy())}</span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <div className="mx-1 hidden h-5 w-px bg-line sm:block" />
            <div className="hidden items-center gap-2.5 sm:flex">
              <Avatar nombre={usuario.nombre} tam={26} />
              <div className="leading-tight">
                <div className="text-xs font-medium">{usuario.nombre}</div>
                <div className="text-2xs text-subtle">{ROL_LABEL[usuario.rol]}</div>
              </div>
            </div>
            <BotonSalir />
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-8 sm:px-8">{children}</main>
      </div>
    </div>
  );
}
