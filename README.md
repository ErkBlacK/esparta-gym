# Esparta Gym · Sistema Integral de Control de Acceso y Gestión de Membresías

Aplicación full-stack para gimnasios: validación de ingreso por **documento o código QR**, gestión de socios y membresías, **congelamientos** que recalculan el vencimiento, **pases de cortesía**, **alertas de mora y vencimiento**, **caja por turno**, **reportes gerenciales** (CSV / PDF) y **clases grupales con control de aforo**. Incluye autenticación con cuatro roles y permisos por módulo.

> Proyecto listo para conectar a MySQL (local con MySQL Workbench o en Railway) y desplegar en Railway desde GitHub.

---

## Contenido

1. [Stack tecnológico](#stack-tecnológico)
2. [Módulos y funcionalidades](#módulos-y-funcionalidades)
3. [Inicio rápido (local con MySQL Workbench)](#inicio-rápido-local-con-mysql-workbench)
4. [Despliegue en Railway](#despliegue-en-railway)
5. [Subir el proyecto a GitHub](#subir-el-proyecto-a-github)
6. [Cuentas de demostración](#cuentas-de-demostración)
7. [Scripts disponibles](#scripts-disponibles)
8. [Estructura del proyecto](#estructura-del-proyecto)
9. [Documentación detallada](#documentación-detallada)

---

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Framework full-stack | **Next.js 14 (App Router)** + **TypeScript** — un solo servicio (frontend + backend) |
| Backend | Server Components, **Server Actions** y Route Handlers (`/api/*`) |
| ORM | **Prisma 7** con adaptador `@prisma/adapter-mariadb` (compatible con MySQL 8+) |
| Base de datos | **MySQL 8** (Workbench local o plugin MySQL de Railway) |
| Autenticación | **NextAuth v4** (credenciales + JWT), contraseñas con **bcrypt** |
| UI | **Tailwind CSS**, tipografías *Inter* y *JetBrains Mono*, diseño Bento Grid, modo oscuro/claro |
| Gráficos | **Recharts** |
| QR | `qrcode` (generación) y `html5-qrcode` (lectura por cámara en el kiosko) |
| Reportes | CSV (servidor) y PDF (`jsPDF` + `jspdf-autotable` en el navegador) |
| Validación | `zod` |

## Módulos y funcionalidades

| Módulo | Qué hace | Roles |
|---|---|---|
| **Login y roles** | Inicio de sesión, sesiones JWT de 12 h, permisos por ruta (middleware) y por acción (servidor) | Todos |
| **Resumen** | KPIs, ingresos 30 días, horas pico, accesos 14 días, vencimientos, clases del día | Todos (finanzas solo Admin/Finanzas) |
| **Kiosko de acceso** | Pantalla completa; documento, lector QR USB o cámara; respuesta gigante verde/roja con foto, plan, días restantes o motivo exacto; registra la bitácora | Admin, Recepción |
| **Socios** | Registro completo (documento, foto, emergencia, observaciones médicas), QR único automático, carnet imprimible, estado en tiempo real (`ACTIVO`, `VENCIDO`, `CONGELADO`, `BLOQUEADO_POR_MORA`) | Admin, Recepción (Instructor: lectura) |
| **Membresías** | Venta, renovación encadenada, abono de pase diario (48 h), locker automático Elite, saldo y abonos, anulación | Admin, Recepción |
| **Congelamientos e invitados** | Congelar por rango de fechas extendiendo el vencimiento; invitados con cupo mensual; alertas a 5 días; cartera en mora | Admin, Recepción |
| **Bitácora de accesos** | Tabla con filtros rápidos (permitidos/denegados, hoy/7/30 días, invitados, búsqueda) | Admin, Recepción |
| **Clases y reservas** | Agenda semanal, aforo máximo, reservas por documento, asistencia y cancelación | Admin, Recepción, Instructor |
| **Caja y pagos** | Apertura/cierre por turno, recaudo por método, arqueo con diferencia, cartera pendiente | Admin, Recepción, Finanzas |
| **Reportes** | Rango de fechas, ingresos, métodos, planes más vendidos, horas pico, motivos de denegación; exportación CSV y PDF | Admin, Finanzas |
| **Planes** | Los 4 planes de negocio precargados (+ Elite anual) con reglas editables: precio, horario, días, ingresos/día, invitados, congelamiento | Admin (edita), Recepción/Finanzas (consulta) |
| **Usuarios y roles** | Alta de personal, cambio de rol, activación, restablecer contraseña, matriz de permisos | Admin |

### Planes precargados

| Código | Plan | Duración | Precio (COP) | Reglas clave |
|---|---|---|---|---|
| `BASE` | Plan Base | Mensual (30 d) | 120.000 | Musculación y cardio · 1 ingreso/día · Lun–Sáb 05:00–22:00 |
| `PRO` | Plan Pro | Trimestral (90 d) | 320.000 | Ilimitado · 1 evaluación física · **1 invitado/mes** · todos los días |
| `ELITE_SEM` | Plan Elite Semestral | 180 d | 580.000 | Acceso preferencial 04:30–23:30 · valoración mensual · **locker** · **congelamiento 30 días** · **2 invitados/mes** |
| `ELITE_ANUAL` | Plan Elite Anual | 365 d | 1.050.000 | Igual a Elite semestral |
| `DAY_PASS` | Pase Diario | 1 d | 25.000 | 06:00–21:00 · **se abona** si compra membresía regular en las siguientes **48 horas** |

---

## Inicio rápido (local con MySQL Workbench)

**Requisitos:** Node.js 20.19+ (recomendado 22), MySQL 8 y MySQL Workbench.

```bash
# 1. Instalar dependencias (también genera el cliente Prisma)
npm install

# 2. Variables de entorno
cp .env.example .env
#    edita DATABASE_URL, por ejemplo:
#    DATABASE_URL="mysql://root:TU_PASSWORD@localhost:3306/gym_access"
```

3. **Crear la base de datos** en MySQL Workbench:
   ```sql
   CREATE DATABASE gym_access CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```
4. **Crear tablas y datos** — elige una opción:
   - **Automática (recomendada):** `npm run db:init` → aplica `database/schema.sql` y carga el escenario de demostración con fechas relativas a hoy.
   - **Manual en Workbench:** abre y ejecuta `database/schema.sql` y luego `database/seed.sql` (o ejecuta `npm run db:seed`).
5. Arrancar:
   ```bash
   npm run dev          # desarrollo en http://localhost:3000
   # o producción
   npm run build && npm start
   ```

## Despliegue en Railway

Resumen (detalle paso a paso en [`docs/02-manual-tecnico-despliegue.md`](docs/02-manual-tecnico-despliegue.md)):

1. Sube el repositorio a GitHub (siguiente sección).
2. En Railway: **New Project → Deploy from GitHub repo** y elige el repositorio.
3. En el mismo proyecto: **+ New → Database → MySQL**.
4. En el servicio de la app → **Variables**:

   | Variable | Valor |
   |---|---|
   | `DATABASE_URL` | `${{MySQL.MYSQL_URL}}` (referencia al plugin MySQL) |
   | `NEXTAUTH_SECRET` | cadena aleatoria larga (`openssl rand -base64 32`) |
   | `NEXTAUTH_URL` | `https://<tu-app>.up.railway.app` |
   | `APP_TIMEZONE` | `America/Bogota` |
   | `NEXT_PUBLIC_GYM_NAME` | Nombre del gimnasio |
   | `SEED_ON_EMPTY` | `true` (demo) o `false` (solo planes + admin) |

5. **Settings → Networking → Generate Domain**. Railway usa `railway.json`:
   - Build: `npm run build` (genera Prisma y compila Next.js).
   - Start: `npm run start:railway` → `scripts/init-db.mjs` crea las tablas si no existen, carga datos si la base está vacía y luego inicia Next.js. **Nunca borra datos existentes.**
   - Healthcheck: `GET /api/health`.

Cada `git push` a la rama conectada vuelve a desplegar automáticamente.

## Subir el proyecto a GitHub

```bash
git init
git add .
git commit -m "Sistema de control de acceso y membresías para gimnasios"
git branch -M main
git remote add origin https://github.com/<tu-usuario>/<tu-repositorio>.git
git push -u origin main
```

> Si el repositorio ya incluye el historial (`.git`), omite `git init` y el primer commit: solo agrega el remoto y haz `git push -u origin main`.

## Cuentas de demostración

| Rol | Correo | Contraseña |
|---|---|---|
| Administrador | `admin@espartagym.co` | `Admin2026*` |
| Recepcionista | `recepcion@espartagym.co` | `Recepcion2026*` (tiene la caja de hoy abierta) |
| Recepcionista 2 | `recepcion2@espartagym.co` | `Recepcion2026*` |
| Instructor | `instructor@espartagym.co` | `Instructor2026*` |
| Instructor 2 | `instructor2@espartagym.co` | `Instructor2026*` |
| Finanzas | `finanzas@espartagym.co` | `Finanzas2026*` |

**Documentos para probar el kiosko:**

| Documento | Resultado esperado |
|---|---|
| `1010101010` | Permitido (Plan Pro, 05:00–22:00) — denegado por horario fuera de esa franja |
| `2020202020` | Denegado · *Membresía vencida el dd/mm* |
| `3030303030` | Denegado · *Saldo pendiente de $170.000 en Plan Pro* |
| `4040404040` | Denegado · *Membresía congelada hasta el dd/mm/aaaa* |
| `99999999` | Denegado · *Documento no registrado* |

> Cambia las contraseñas en **Usuarios y roles** antes de usar el sistema en producción.

## Scripts disponibles

| Script | Descripción |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | `prisma generate` + `next build` |
| `npm start` | Servidor de producción (usa `PORT`) |
| `npm run start:railway` | Inicializa la BD si hace falta y arranca (usado por Railway) |
| `npm run db:init` | Crea tablas desde `schema.sql` y datos si la BD está vacía (idempotente) |
| `npm run db:seed` | **Borra** y recarga el escenario de demostración |
| `npm run db:push` | Sincroniza `schema.prisma` con la BD usando Prisma (alternativa a `schema.sql`) |
| `npm run db:studio` | Prisma Studio para explorar datos |
| `npm run typecheck` | Verificación de tipos TypeScript |

## Estructura del proyecto

```
├── database/
│   ├── schema.sql            # DDL MySQL equivalente a schema.prisma (Workbench)
│   └── seed.sql              # Datos de demostración exportados (Workbench)
├── docs/                     # Arquitectura, diccionario de datos, despliegue y manual de usuario
├── prisma/
│   ├── schema.prisma         # Modelo de datos (12 tablas, 13 enumeraciones)
│   └── seed.ts               # Escenario demo relativo a la fecha actual
├── scripts/init-db.mjs       # Inicialización automática para Railway
├── src/
│   ├── acciones/             # Server Actions (mutaciones con validación y permisos)
│   ├── app/
│   │   ├── (app)/            # Módulos con menú lateral (dashboard, socios, operaciones…)
│   │   ├── kiosko/           # Punto de entrada a pantalla completa
│   │   ├── login/
│   │   └── api/              # auth, health, export CSV
│   ├── components/           # UI (Bento cards, badges, formularios, gráficos)
│   ├── lib/
│   │   ├── reglas.ts         # Motor de reglas de negocio (funciones puras)
│   │   ├── servicios.ts      # Validación de acceso, sincronización de estados
│   │   ├── permisos.ts       # Matriz de permisos por módulo y acción
│   │   ├── fechas.ts         # Zona horaria del negocio
│   │   └── metricas.ts       # Agregaciones para dashboard y reportes
│   └── middleware.ts         # Protección de rutas por rol
├── prisma.config.ts
└── railway.json
```

## Documentación detallada

- [`docs/01-arquitectura-y-diccionario-de-datos.md`](docs/01-arquitectura-y-diccionario-de-datos.md) — arquitectura, diagrama entidad-relación y diccionario de cada tabla.
- [`docs/02-manual-tecnico-despliegue.md`](docs/02-manual-tecnico-despliegue.md) — `.env`, MySQL Workbench, Railway, solución de problemas.
- [`docs/03-manual-de-usuario-por-rol.md`](docs/03-manual-de-usuario-por-rol.md) — guía de uso por rol para la sustentación.
- [`docs/04-reglas-de-negocio.md`](docs/04-reglas-de-negocio.md) — reglas de acceso, estados, congelamiento, invitados, pase diario y caja.
