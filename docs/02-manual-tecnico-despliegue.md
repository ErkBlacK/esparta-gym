# 2. Manual técnico de despliegue

## 2.1 Variables de entorno

| Variable | Obligatoria | Ejemplo | Uso |
|---|---|---|---|
| `DATABASE_URL` | Sí | `mysql://root:clave@localhost:3306/gym_access` | Conexión MySQL (Prisma, init-db y seed) |
| `NEXTAUTH_SECRET` | Sí | `k3J9…` (32+ caracteres aleatorios) | Firma de los JWT de sesión |
| `NEXTAUTH_URL` | Sí en producción | `https://esparta-gym.up.railway.app` | URL pública usada por NextAuth |
| `APP_TIMEZONE` | No (default `America/Bogota`) | `America/Bogota` | Horarios de acceso, “hoy”, cierres de caja |
| `NEXT_PUBLIC_GYM_NAME` | No | `Esparta Gym` | Nombre visible (se incrusta en el build) |
| `SEED_ON_EMPTY` | No (default `true`) | `true` / `false` | Qué hacer si la BD está vacía al arrancar |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | No | `admin@migym.co` / `Clave2026*` | Administrador inicial cuando `SEED_ON_EMPTY=false` |
| `DB_POOL_SIZE` | No (default 8) | `8` | Conexiones simultáneas del pool |

Genera el secreto con:

```bash
openssl rand -base64 32
# o con Node:
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

> Si la contraseña de MySQL tiene caracteres especiales (`@`, `#`, `/`, `:`), codifícalos en la URL (`@` → `%40`, `#` → `%23`).

---

## 2.2 Entorno local con MySQL Workbench

1. **Instalar** Node.js 22 LTS, MySQL Server 8 y MySQL Workbench.
2. **Crear la base** en Workbench (pestaña *Query*):
   ```sql
   CREATE DATABASE gym_access CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```
3. **Configurar `.env`** en la raíz del proyecto:
   ```env
   DATABASE_URL="mysql://root:TU_PASSWORD@localhost:3306/gym_access"
   NEXTAUTH_SECRET="un-secreto-largo"
   NEXTAUTH_URL="http://localhost:3000"
   APP_TIMEZONE="America/Bogota"
   ```
4. **Instalar dependencias:** `npm install` (ejecuta `prisma generate`).
5. **Crear tablas y datos** (elige una):
   - `npm run db:init` — automático: crea el esquema desde `database/schema.sql` y carga el escenario demo.
   - En Workbench: *File → Open SQL Script* → `database/schema.sql` → ⚡ *Execute*; luego `database/seed.sql` → ⚡.
     *(Recuerda seleccionar `gym_access` como esquema por defecto: doble clic sobre él en el panel Schemas.)*
   - `npm run db:push` y después `npm run db:seed` — usando Prisma directamente.
6. **Ejecutar:** `npm run dev` y abrir `http://localhost:3000`.

### Ver los datos en Workbench

- Panel *Schemas* → `gym_access` → *Tables*. Clic derecho → *Select Rows*.
- Vista útil: `SELECT * FROM v_saldos_membresias WHERE saldoPendiente > 0;`
- Diagrama EER: *Database → Reverse Engineer…* sobre `gym_access` genera el diagrama con todas las relaciones.

> `database/seed.sql` contiene fechas fijas del día en que se exportó. Para tener siempre socios “por vencer”, “congelados” y “en mora” relativos a la fecha actual, usa `npm run db:seed`.

---

## 2.3 Conectar Workbench a la base de datos de Railway

1. En Railway abre el servicio **MySQL → Variables** (o *Connect*): copia `MYSQLHOST` público (TCP Proxy), puerto, usuario `root`, contraseña y base `railway`.
   - El host público tiene la forma `xxxxx.proxy.rlwy.net` y un puerto como `43210` (usa **Public Network**, no `mysql.railway.internal`).
2. En Workbench: *Database → Manage Connections → New*:
   - Hostname: el host público · Port: el puerto público · Username: `root`
   - *Store in Vault…* → contraseña de Railway · Default Schema: `railway`
3. *Test Connection* → *OK*. Desde ahí puedes ejecutar `schema.sql`/`seed.sql` o consultar los datos de producción.
4. Para desarrollar localmente contra Railway, usa en tu `.env` la `MYSQL_PUBLIC_URL` del plugin.

---

## 2.4 Despliegue en Railway paso a paso

1. **Subir a GitHub** (ver README → *Subir el proyecto a GitHub*).
2. En [railway.com](https://railway.com): **New Project → Deploy from GitHub repo** → autoriza y elige el repositorio.
3. En el lienzo del proyecto: **+ Create → Database → Add MySQL**.
4. Abre el servicio de la aplicación → **Variables → New Variable**:
   ```
   DATABASE_URL=${{MySQL.MYSQL_URL}}
   NEXTAUTH_SECRET=<secreto aleatorio>
   NEXTAUTH_URL=https://<dominio-generado>.up.railway.app
   APP_TIMEZONE=America/Bogota
   NEXT_PUBLIC_GYM_NAME=Esparta Gym
   SEED_ON_EMPTY=true
   ```
   `${{MySQL.MYSQL_URL}}` es una *variable de referencia*: Railway la reemplaza por la URL interna (`mysql.railway.internal`), más rápida y sin costo de egress.
5. **Settings → Networking → Generate Domain** y copia el dominio en `NEXTAUTH_URL`.
6. Railway detecta Node.js y aplica `railway.json`:
   | Fase | Comando | Qué hace |
   |---|---|---|
   | Install | `npm ci` | Instala dependencias y ejecuta `prisma generate` |
   | Build | `npm run build` | Genera el cliente Prisma y compila Next.js (no necesita la BD) |
   | Start | `npm run start:railway` | `scripts/init-db.mjs` → crea tablas si faltan, carga datos si está vacía → `next start` en `$PORT` |
   | Healthcheck | `GET /api/health` | Responde 200 cuando la app y MySQL están arriba |
7. Revisa **Deployments → View Logs**. Verás algo como:
   ```
   → Creando tablas desde database/schema.sql
   ✔ Esquema creado
   → Base vacía: cargando datos de demostración
   ✔ Seed completado: ACTIVO=26, VENCIDO=6, CONGELADO=3, BLOQUEADO_POR_MORA=3
   ▲ Next.js 14.2.35 - Local: http://localhost:8080
   ```
8. Abre el dominio e inicia sesión con `admin@espartagym.co / Admin2026*`. **Cambia las contraseñas** en *Usuarios y roles*.

### Despliegues siguientes

Cada `git push` a `main` dispara un nuevo despliegue. `init-db` detecta que el esquema y los usuarios ya existen y **no modifica datos**.

### Pasar a producción real (sin datos demo)

1. Antes del primer despliegue define `SEED_ON_EMPTY=false`, `ADMIN_EMAIL` y `ADMIN_PASSWORD`.
2. Se crearán solo los 5 planes base y el administrador.
3. Si ya cargaste la demo y quieres empezar limpio: en Workbench ejecuta `database/schema.sql` (recrea las tablas vacías) y vuelve a desplegar.

### Cambios futuros al modelo de datos

1. Edita `prisma/schema.prisma`.
2. Aplica el cambio con `npm run db:push` apuntando a la BD (local o `MYSQL_PUBLIC_URL` de Railway) y actualiza `database/schema.sql` para mantener el script de Workbench sincronizado.

---

## 2.5 Solución de problemas

| Síntoma | Causa probable | Solución |
|---|---|---|
| `/api/health` responde 503 | `DATABASE_URL` incorrecta o MySQL detenido | Verifica la variable de referencia y que el plugin MySQL esté *Active* |
| Login redirige al login otra vez | `NEXTAUTH_URL` no coincide con el dominio o falta `NEXTAUTH_SECRET` | Ajusta ambas variables y redepliega |
| `RSA public key is not available` / error de autenticación MySQL | MySQL 8 con `caching_sha2_password` | Ya se envía `allowPublicKeyRetrieval`; verifica usuario/contraseña. En local también puedes usar `ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY '…';` |
| Horarios del kiosko desfasados | Zona horaria | Define `APP_TIMEZONE` con la zona del gimnasio |
| “Debes abrir tu caja de turno…” | Regla de negocio: todo pago entra a una caja | *Caja y pagos → Abrir caja* |
| La cámara no abre en el kiosko | El navegador exige HTTPS o permiso de cámara | Usa el dominio HTTPS de Railway y acepta el permiso; o un lector QR USB (funciona como teclado) |
| Error de build `Failed to fetch … binaries.prisma.sh` | Red sin acceso a los binarios de Prisma | En Railway no ocurre; en redes restringidas define `PRISMA_ENGINES_MIRROR` |

---

## 2.6 Hardware del punto de entrada

- **Lector QR/código de barras USB** (modo teclado + Enter): funciona sin configuración; el kiosko mantiene el foco en el campo de entrada.
- **Cámara**: botón *Usar cámara* (requiere HTTPS).
- **Torniquete**: la respuesta *Acceso permitido* representa la señal de apertura. Para integrar un relé físico, conecta el controlador en `src/lib/servicios.ts → validarAcceso()` justo después de registrar el acceso permitido (p. ej. una petición HTTP a la controladora IP del torniquete).
