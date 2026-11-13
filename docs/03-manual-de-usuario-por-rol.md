# 3. Manual de usuario por rol

Este manual explica qué hace cada módulo y cómo lo usa cada rol. Sirve como guion para la sustentación: al final hay un **recorrido de demostración de 10 minutos**.

## 3.1 Roles y permisos

| Módulo | Administrador | Recepcionista | Instructor | Finanzas |
|---|:-:|:-:|:-:|:-:|
| Resumen | ● | ● | ● | ● |
| Kiosko de acceso | ● | ● | | |
| Socios | ● (edita) | ● (edita) | ● (consulta) | |
| Congelamientos e invitados | ● | ● | | |
| Bitácora de accesos | ● | ● | | |
| Clases y reservas | ● (crea clases) | ● (reserva) | ● (reserva y asistencia) | |
| Caja y pagos | ● (todas las cajas) | ● (su caja) | | ● (todas las cajas) |
| Reportes y exportación | ● | | | ● |
| Planes | ● (edita) | ● (consulta) | | ● (consulta) |
| Usuarios y roles | ● | | | |

Si un usuario intenta abrir un módulo sin permiso, el sistema lo devuelve al *Resumen* con el aviso “Tu rol no tiene acceso al módulo…”. Además cada acción (vender, abonar, congelar, exportar…) vuelve a verificar el permiso en el servidor.

---

## 3.2 Inicio de sesión

1. Abre la aplicación y escribe tu correo y contraseña.
2. La sesión dura 12 horas. *Cerrar sesión* está en la esquina superior derecha.
3. El botón **Oscuro/Claro** cambia el tema y se recuerda en el navegador.

---

## 3.3 Recepcionista

### Abrir la caja (inicio de turno)
*Caja y pagos → Mi caja*: elige el turno (Mañana, Tarde, Noche), escribe la base en efectivo y pulsa **Abrir caja**. Sin caja abierta no se pueden registrar pagos.

### Registrar un socio
*Socios → Registrar socio*:
1. Sube o toma la fotografía (se recorta y optimiza sola).
2. Completa documento, nombres, teléfono, **contacto de emergencia** y **observaciones médicas**.
3. Al guardar se genera el **código QR único** y se abre el perfil.

### Vender o renovar una membresía
En el perfil del socio → **Vender membresía** (o *Renovar / vender plan*):
1. Elige el plan. El resumen muestra precio, abono y saldo.
2. **Fecha de inicio:** si el socio tiene una membresía vigente, el sistema propone iniciar al día siguiente de su vencimiento (renovación encadenada).
3. **Pase diario:** si el socio compró un pase diario en las últimas 48 h, aparece la casilla *Pase diario abonable* y su valor se descuenta.
4. **Pago inicial:** puede ser total o parcial. Si es parcial queda saldo pendiente (3 días de gracia; después el socio queda *Bloqueado por mora*).
5. En planes Elite se asigna un **locker** automáticamente.

### Cobrar un saldo (abono)
Perfil → tarjeta *Saldo pendiente* → **Abonar**. Al cubrir el total, el socio queda habilitado de inmediato.

### Kiosko de acceso
*Kiosko de acceso* abre la pantalla completa del punto de entrada:
- El socio muestra su **QR** al lector (o a la cámara con *Usar cámara*) o se digita su **documento** y Enter.
- **Verde – Acceso permitido:** foto, nombre, plan, días restantes y locker; suena un tono de confirmación y se registra el ingreso (“señal enviada al torniquete”). Si vence pronto o tiene observaciones médicas se muestra un aviso.
- **Rojo – Acceso denegado:** motivo exacto, por ejemplo:
  - *Membresía vencida el 15/10*
  - *Saldo pendiente de $170.000 en Plan Pro*
  - *Membresía congelada hasta el 23/11/2026*
  - *Fuera de horario permitido (Lun a Sáb 05:00–22:00)*
  - *Límite de 1 ingreso diario alcanzado*
  - *Documento no registrado en el sistema*
- La pantalla vuelve sola al estado de espera en 4,5 s (o con *Esc* / clic).
- La columna derecha lista las validaciones de la sesión.

### Congelar una membresía
*Congelamientos e invitados → Congelar membresía*: elige el socio (solo aparecen planes que lo permiten), las fechas y el motivo. El vencimiento se **extiende automáticamente** por los días congelados. Un congelamiento programado (que aún no inicia) se puede **anular** y el vencimiento vuelve a su fecha anterior.

### Registrar un invitado
*Congelamientos e invitados → Pase de cortesía*: documento del titular + datos del invitado. El sistema verifica que el titular esté activo, que su plan incluya invitados y que tenga cupo este mes (Pro 1, Elite 2). El ingreso queda en la bitácora como *Invitado*.

### Alertas
En la misma pantalla:
- **Alertas de vencimiento:** socios que vencen en los próximos 5 días (rojo ≤ 3 días, ámbar 4–5). *Renovar →* lleva al perfil. Si ya renovó aparece *Renovado*.
- **Mora y saldos pendientes:** quién debe y cuánto.

### Reservas de clases
*Clases y reservas*: clic en una clase → elige la fecha → digita el documento → **Reservar**. Se rechaza si el aforo está completo, si el socio no está activo o si ya tiene cupo.

### Cerrar la caja (fin de turno)
*Caja y pagos → Mi caja*: cuenta el efectivo físico, escríbelo en *Efectivo contado* y pulsa **Cerrar caja**. El sistema totaliza por método y registra la **diferencia** (cuadrada, sobrante o faltante) en *Cierres de caja*.

---

## 3.4 Instructor

- **Resumen:** asistencia, horas pico y clases del día (sin información financiera).
- **Socios (consulta):** ver ficha, **observaciones médicas** y contacto de emergencia.
- **Evaluaciones físicas:** en el perfil → *Nueva evaluación* (peso, estatura, % grasa, masa muscular, notas). El IMC se calcula automáticamente. Plan Pro incluye 1 evaluación; Elite, valoración mensual.
- **Clases:** por defecto ve **sus clases**; puede reservar, marcar *Asistió* o *Cancelar* reservas.

---

## 3.5 Finanzas

- **Caja y pagos:** recaudo de hoy de todas las cajas, cajas abiertas, **cartera pendiente** e historial de **cierres** con diferencias.
- **Reportes:** selecciona el periodo (7, 30, 90 días o fechas personalizadas):
  - Ingresos por día, recaudo por método, ticket promedio.
  - Membresías más vendidas.
  - Horas pico de asistencia y accesos por día (permitidos vs. denegados).
  - Motivos de denegación.
  - **Exportar PDF** (informe gerencial) y **CSV** de pagos, membresías, accesos y socios (se abren en Excel).
- **Planes:** consulta de precios y reglas.

---

## 3.6 Administrador

Todo lo anterior, más:
- **Planes:** *Editar reglas* — precio, duración, franja horaria, días permitidos, ingresos por día, invitados, días de congelamiento, evaluaciones y estado. Los cambios aplican de inmediato en el kiosko.
- **Usuarios y roles:** crear personal, cambiar rol, desactivar, restablecer contraseña; ver la matriz de permisos.
- **Clases:** programar nuevas clases (varios días a la vez), con instructor, sala y aforo.
- **Anular membresías** desde el historial del socio.
- **Regenerar QR** (si el socio perdió el carnet, el anterior deja de funcionar) y asignar/liberar lockers.

---

## 3.7 Recorrido sugerido para la sustentación (10 minutos)

1. **Login como Administrador** → *Resumen*: explicar el Bento Grid, KPIs y gráficos.
2. **Kiosko** con los documentos de prueba:
   - un socio activo de plan Elite (ver *Socios* filtrando *Activo*) → **verde** con foto, plan, días restantes y locker;
   - `2020202020` → **rojo**: *Membresía vencida*;
   - `3030303030` → **rojo**: *Saldo pendiente*;
   - `4040404040` → **rojo**: *Membresía congelada*.
3. **Resolver la mora:** perfil del socio `3030303030` → *Abonar* el saldo → volver al kiosko → ahora **verde** (iniciar sesión como `recepcion@espartagym.co`, que tiene la caja abierta).
4. **Congelamiento:** congelar 7 días un Elite y mostrar el nuevo vencimiento en el perfil.
5. **Pase diario + abono:** registrar un socio nuevo → vender *Pase Diario* → vender *Plan Base*: aparece el abono de $25.000.
6. **Invitados:** registrar un invitado a un Pro (1/mes) y repetir para mostrar *Cupo agotado*.
7. **Clases:** reservar hasta llenar aforo o mostrar la clase marcada *Aforo completo*.
8. **Cierre de caja** con una diferencia y verla en *Cierres de caja*.
9. **Login como Finanzas** → *Reportes* → exportar PDF y CSV.
10. **Login como Instructor** → intentar abrir `/finanzas` para mostrar el control de permisos.
