import { requerirSesion } from "@/lib/auth";
import { puede } from "@/lib/permisos";
import { redirect } from "next/navigation";
import { crearSocio } from "@/acciones/socios";
import { PageHeader, Card, ButtonLink } from "@/components/ui";
import { FormAccion, BotonEnviar } from "@/components/forms";
import { CamposSocio } from "@/components/socio-campos";

export const metadata = { title: "Nuevo socio" };

export default async function NuevoSocio() {
  const usuario = await requerirSesion();
  if (!puede(usuario.rol, "gestionarSocios")) redirect("/socios");
  return (
    <div className="mx-auto max-w-3xl animate-fade-in">
      <PageHeader eyebrow="Socios" title="Registrar socio" description="Al guardar se genera automáticamente su código QR único para el carnet de acceso." />
      <Card className="p-6">
        <FormAccion action={crearSocio} reiniciar={false}>
          <CamposSocio />
          <div className="mt-8 flex justify-end gap-2 border-t border-line pt-5">
            <ButtonLink href="/socios" variante="ghost">Cancelar</ButtonLink>
            <BotonEnviar>Registrar socio</BotonEnviar>
          </div>
        </FormAccion>
      </Card>
    </div>
  );
}
