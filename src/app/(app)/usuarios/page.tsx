import { prisma } from "@/lib/prisma";
import { requerirSesion } from "@/lib/auth";
import { MODULOS } from "@/lib/permisos";
import { ROL_LABEL, ROLES } from "@/lib/constants";
import { formatoFechaHora } from "@/lib/fechas";
import { actualizarUsuario, crearUsuario } from "@/acciones/admin";
import { Avatar, Badge, Card, CardHeader, PageHeader } from "@/components/ui";
import { PanelFormulario } from "@/components/forms";

export const metadata = { title: "Usuarios y roles" };

export default async function Usuarios() {
  const yo = await requerirSesion();
  const usuarios = await prisma.usuario.findMany({ orderBy: [{ activo: "desc" }, { rol: "asc" }, { nombre: "asc" }] });
  return (
    <div className="animate-fade-in">
      <PageHeader
        eyebrow="Gestión"
        title="Usuarios y roles"
        description="Cuentas del personal y matriz de permisos por módulo."
        actions={
          <PanelFormulario disparador="Nuevo usuario" titulo="Crear usuario" action={crearUsuario} textoEnviar="Crear usuario">
            <label className="block"><span className="label">Nombre completo</span><input name="nombre" required className="input" /></label>
            <label className="block"><span className="label">Correo</span><input name="email" type="email" required className="input" /></label>
            <label className="block">
              <span className="label">Rol</span>
              <select name="rol" className="input" defaultValue="RECEPCIONISTA">{ROLES.map((r) => <option key={r} value={r}>{ROL_LABEL[r]}</option>)}</select>
            </label>
            <label className="block"><span className="label">Contraseña inicial</span><input name="password" type="text" required className="input font-mono" placeholder="Mín. 8, una mayúscula y un número" /></label>
          </PanelFormulario>
        }
      />
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
        <Card className="overflow-hidden lg:col-span-7">
          <div className="overflow-x-auto">
            <table className="tabla">
              <thead><tr><th>Usuario</th><th>Rol</th><th>Estado</th><th>Creado</th><th></th></tr></thead>
              <tbody>
                {usuarios.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div className="flex items-center gap-2.5">
                        <Avatar nombre={u.nombre} tam={28} />
                        <div><div className="font-medium">{u.nombre}{u.id === yo.id && <span className="ml-1.5 text-2xs text-subtle">(tú)</span>}</div><div className="text-2xs text-subtle">{u.email}</div></div>
                      </div>
                    </td>
                    <td className="text-xs">{ROL_LABEL[u.rol]}</td>
                    <td><Badge tono={u.activo ? "ok" : "neutral"}>{u.activo ? "Activo" : "Inactivo"}</Badge></td>
                    <td className="whitespace-nowrap font-mono text-2xs text-subtle">{formatoFechaHora(u.createdAt)}</td>
                    <td className="text-right">
                      <PanelFormulario disparador="Editar" varianteDisparador="ghost" tamDisparador="sm" titulo={`Editar ${u.nombre}`} descripcion={u.email} action={actualizarUsuario}>
                        <input type="hidden" name="id" value={u.id} />
                        <label className="block"><span className="label">Rol</span><select name="rol" defaultValue={u.rol} className="input">{ROLES.map((r) => <option key={r} value={r}>{ROL_LABEL[r]}</option>)}</select></label>
                        <label className="block"><span className="label">Estado</span><select name="activo" defaultValue={String(u.activo)} className="input"><option value="true">Activo</option><option value="false">Inactivo (no puede iniciar sesión)</option></select></label>
                        <label className="block"><span className="label">Nueva contraseña (opcional)</span><input name="password" className="input font-mono" placeholder="Dejar vacío para conservar" /></label>
                      </PanelFormulario>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <Card className="overflow-hidden lg:col-span-5">
          <CardHeader title="Matriz de permisos" description="Módulos visibles por rol" />
          <div className="mt-3 overflow-x-auto">
            <table className="tabla">
              <thead><tr><th>Módulo</th>{ROLES.map((r) => <th key={r} className="text-center">{ROL_LABEL[r].slice(0, 5)}.</th>)}</tr></thead>
              <tbody>
                {MODULOS.map((m) => (
                  <tr key={m.href}>
                    <td className="text-xs">{m.label}</td>
                    {ROLES.map((r) => (
                      <td key={r} className="text-center">
                        {m.roles.includes(r) ? <span className="inline-block h-2 w-2 rounded-full bg-ok" aria-label="Permitido" /> : <span className="inline-block h-px w-2 bg-subtle/60" aria-label="Sin acceso" />}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
