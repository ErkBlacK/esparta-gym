import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";
import { GYM_NAME } from "@/lib/constants";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: `${GYM_NAME} · Control de acceso`, template: `%s · ${GYM_NAME}` },
  description: "Sistema integral de control de acceso y gestión de membresías para gimnasios.",
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = { themeColor: "#09090B" };

// Aplica el tema guardado antes de pintar (evita parpadeo).
const scriptTema = `try{var t=localStorage.getItem('tema');if(t==='light'){document.documentElement.classList.remove('dark')}else{document.documentElement.classList.add('dark')}}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: scriptTema }} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
