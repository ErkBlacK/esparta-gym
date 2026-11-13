import { requerirSesion } from "@/lib/auth";
import { GYM_NAME } from "@/lib/constants";
import { Kiosko } from "./kiosko";

export const metadata = { title: "Kiosko de acceso" };

export default async function KioskoPage() {
  const usuario = await requerirSesion();
  return <Kiosko gym={GYM_NAME} operador={usuario.nombre} />;
}
