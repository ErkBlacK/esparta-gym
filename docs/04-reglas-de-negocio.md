# 4. Reglas de negocio implementadas

Todas las reglas viven en `src/lib/reglas.ts` (funciones puras, fáciles de probar) y se aplican desde `src/lib/servicios.ts` y `src/acciones/*`.

## 4.1 Estado del socio (tiempo real)

Se calcula con `evaluarEstado()` a partir de las membresías **activas** (no anuladas):

| Prioridad | Estado | Condición |
|---|---|---|
| 1 | `BLOQUEADO_POR_MORA` | Alguna membresía tiene saldo > 0 y pasaron más de **3 días** (`GRACIA_MORA_DIAS`) desde su inicio |
| 2 | `CONGELADO` | La membresía vigente tiene un congelamiento que cubre el día de hoy |
| 3 | `ACTIVO` | Existe una membresía con `fechaInicio ≤ hoy ≤ fechaFinAjustada` |
| 4 | `VENCIDO` | Ninguna de las anteriores (incluye socios sin membresía) |

El estado se recalcula y persiste al abrir el kiosko, el listado de socios, el perfil, el dashboard y las alertas, y tras cada venta, abono o congelamiento.

## 4.2 Validación de acceso (kiosko)

Orden de evaluación (`motivoDenegacion()`), el primer fallo determina el motivo mostrado:

1. Documento o QR inexistente → *Documento no registrado en el sistema* / *Código QR no registrado*.
2. Mora → *Saldo pendiente de $X en {plan}*.
3. Congelada → *Membresía congelada hasta el dd/mm/aaaa*.
4. Sin vigencia → *La membresía inicia el …* · *Membresía vencida el dd/mm* · *No tiene membresía registrada*.
5. Día u hora fuera del plan → *Fuera de horario permitido (días HH:MM–HH:MM)*.
6. Límite diario (`accesosPorDia` > 0) → *Límite de N ingreso(s) diario(s) alcanzado*.

Si todo pasa: se registra `PERMITIDO` y se devuelven foto, plan, días restantes, vencimiento, locker y avisos (vence en ≤ 5 días, saldo en periodo de gracia, observaciones médicas). **Cada intento**, permitido o no, queda en `accesos`.

El kiosko distingue QR de documento por el prefijo `GYM-` del token.

## 4.3 Venta y renovación

- `fechaFin = fechaInicio + duracionDias − 1`; `fechaFinAjustada` inicia igual a `fechaFin`.
- **Renovación encadenada:** si el socio tiene una membresía regular vigente o futura, la fecha sugerida es el día siguiente al último vencimiento. No se permiten dos membresías regulares superpuestas.
- No se venden membresías con inicio en fecha pasada.
- **Pase diario:** se paga completo; no puede coincidir con un día ya cubierto.
- **Abono del pase diario:** si el socio compra un plan regular dentro de las **48 h** siguientes a la compra de un pase diario no abonado, su valor pagado se descuenta (`descuento`, `abonoDayPassId`). La relación es única: un pase diario se abona una sola vez.
- **Locker:** planes con `lockerIncluido` asignan el primer número libre (1–120) si el socio no tiene uno.
- **Pago inicial:** opcional y parcial; si es > 0 exige caja abierta del usuario.

## 4.4 Saldos y mora

- `saldo = montoTotal − Σ pagos`.
- Abonos: no pueden superar el saldo; quedan con concepto `ABONO` en la caja del cajero.
- Al quedar en cero, el estado se recalcula y el socio se desbloquea inmediatamente.

## 4.5 Congelamiento

- Solo planes con `maxDiasCongelamiento > 0` (Elite: 30 días por membresía, acumulables en varios periodos).
- La fecha inicial no puede ser pasada y debe estar dentro de la vigencia; la final debe ser ≥ inicial.
- No puede traslaparse con otro congelamiento de la misma membresía.
- `dias = fin − inicio + 1`; se suma a `fechaFinAjustada` y a `diasCongelados`.
- Un congelamiento que aún no inicia puede anularse; la extensión se revierte.
- No se puede congelar una membresía en mora.

## 4.6 Pases de cortesía (invitados)

- El titular debe estar `ACTIVO` (sin mora ni congelamiento).
- Cupo mensual según plan (`invitadosMes`): Pro 1, Elite 2, Base 0.
- El cupo se cuenta por mes calendario en la zona horaria del gimnasio.
- El registro crea el invitado y un acceso `tipo = INVITADO` en la bitácora.

## 4.7 Caja

- Un usuario solo puede tener **una caja abierta**.
- Todo pago se asocia a la caja abierta del usuario que lo recibe.
- Al cerrar: `totalEfectivo`, `totalTarjeta`, `totalTransferencia` se calculan de los pagos de la caja; `diferencia = efectivoContado − (montoInicial + totalEfectivo)`.
- Un recepcionista solo cierra su propia caja; Administrador y Finanzas pueden cerrar cualquiera.

## 4.8 Clases grupales

- Reserva por sesión (clase + fecha). La fecha debe coincidir con el día de la clase y no ser pasada.
- Solo socios `ACTIVO`.
- Aforo: reservas `CONFIRMADA` + `ASISTIO` < `aforoMax`.
- Un socio no puede tener dos reservas activas en la misma sesión (índice único); una reserva cancelada puede reactivarse.

## 4.9 Seguridad

- Contraseñas con bcrypt; política mínima: 8 caracteres, una mayúscula y un número.
- Sesiones JWT firmadas con `NEXTAUTH_SECRET`, duración 12 h.
- Autorización en dos niveles: middleware (rutas) y servidor (cada acción y la exportación).
- Un administrador no puede desactivarse ni quitarse su propio rol.
- Regenerar el QR invalida el carnet anterior.
