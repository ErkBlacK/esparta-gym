-- ════════════════════════════════════════════════════════════════════════════
--  Sistema Integral de Control de Acceso y Gestión de Membresías para Gimnasios
--  Script DDL para MySQL 8+ (MySQL Workbench / Railway MySQL)
--  Equivalente exacto de prisma/schema.prisma
--
--  Uso en Workbench:  File → Open SQL Script → schema.sql → Execute (⚡)
--  Después ejecuta database/seed.sql para cargar los datos de demostración.
-- ════════════════════════════════════════════════════════════════════════════

-- Descomenta las dos líneas siguientes si trabajas en un servidor local nuevo.
-- En Railway la base ya existe y se llama `railway`.
-- CREATE DATABASE IF NOT EXISTS gym_access CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- USE gym_access;

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS `evaluaciones_fisicas`;
DROP TABLE IF EXISTS `reservas`;
DROP TABLE IF EXISTS `clases_grupales`;
DROP TABLE IF EXISTS `accesos`;
DROP TABLE IF EXISTS `pagos`;
DROP TABLE IF EXISTS `cajas_turno`;
DROP TABLE IF EXISTS `invitados`;
DROP TABLE IF EXISTS `congelamientos`;
DROP TABLE IF EXISTS `membresias`;
DROP TABLE IF EXISTS `socios`;
DROP TABLE IF EXISTS `planes`;
DROP TABLE IF EXISTS `usuarios`;

SET FOREIGN_KEY_CHECKS = 1;

-- ─── usuarios: personal que inicia sesión ───────────────────────────────────
CREATE TABLE `usuarios` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `nombre` VARCHAR(120) NOT NULL,
  `email` VARCHAR(160) NOT NULL,
  `passwordHash` VARCHAR(100) NOT NULL,
  `rol` ENUM('ADMINISTRADOR', 'RECEPCIONISTA', 'INSTRUCTOR', 'FINANZAS') NOT NULL,
  `activo` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `usuarios_email_key`(`email`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ─── planes: catálogo comercial y reglas de acceso ──────────────────────────
CREATE TABLE `planes` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `codigo` VARCHAR(30) NOT NULL,
  `nombre` VARCHAR(80) NOT NULL,
  `descripcion` TEXT NOT NULL,
  `tipo` ENUM('MENSUAL', 'TRIMESTRAL', 'SEMESTRAL', 'ANUAL', 'DIARIO') NOT NULL,
  `duracionDias` INTEGER NOT NULL,
  `precio` DECIMAL(12, 2) NOT NULL,
  `invitadosMes` INTEGER NOT NULL DEFAULT 0,
  `evaluacionesIncluidas` INTEGER NOT NULL DEFAULT 0,
  `valoracionMensual` BOOLEAN NOT NULL DEFAULT false,
  `lockerIncluido` BOOLEAN NOT NULL DEFAULT false,
  `maxDiasCongelamiento` INTEGER NOT NULL DEFAULT 0,
  `accesoPreferencial` BOOLEAN NOT NULL DEFAULT false,
  `accesosPorDia` INTEGER NOT NULL DEFAULT 1,
  `horaInicio` VARCHAR(5) NOT NULL DEFAULT '05:00',
  `horaFin` VARCHAR(5) NOT NULL DEFAULT '22:00',
  `diasPermitidos` VARCHAR(20) NOT NULL DEFAULT '1,2,3,4,5,6,7',
  `activo` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `planes_codigo_key`(`codigo`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ─── socios: personas inscritas ─────────────────────────────────────────────
CREATE TABLE `socios` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `tipoDocumento` ENUM('CC', 'TI', 'CE', 'PASAPORTE') NOT NULL DEFAULT 'CC',
  `documento` VARCHAR(30) NOT NULL,
  `nombres` VARCHAR(80) NOT NULL,
  `apellidos` VARCHAR(80) NOT NULL,
  `fechaNacimiento` DATE NULL,
  `genero` VARCHAR(20) NULL,
  `email` VARCHAR(160) NULL,
  `telefono` VARCHAR(30) NOT NULL,
  `direccion` VARCHAR(200) NULL,
  `fotoUrl` MEDIUMTEXT NULL,
  `contactoEmergenciaNombre` VARCHAR(120) NOT NULL,
  `contactoEmergenciaTelefono` VARCHAR(30) NOT NULL,
  `contactoEmergenciaParentesco` VARCHAR(40) NULL,
  `observacionesMedicas` TEXT NULL,
  `qrToken` VARCHAR(64) NOT NULL,
  `estado` ENUM('ACTIVO', 'VENCIDO', 'CONGELADO', 'BLOQUEADO_POR_MORA') NOT NULL DEFAULT 'VENCIDO',
  `lockerNumero` INTEGER NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `socios_documento_key`(`documento`),
  UNIQUE INDEX `socios_qrToken_key`(`qrToken`),
  UNIQUE INDEX `socios_lockerNumero_key`(`lockerNumero`),
  INDEX `socios_estado_idx`(`estado`),
  INDEX `socios_apellidos_nombres_idx`(`apellidos`, `nombres`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ─── membresias: venta de un plan a un socio ────────────────────────────────
CREATE TABLE `membresias` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `socioId` INTEGER NOT NULL,
  `planId` INTEGER NOT NULL,
  `fechaInicio` DATE NOT NULL,
  `fechaFin` DATE NOT NULL,
  `fechaFinAjustada` DATE NOT NULL,
  `precioLista` DECIMAL(12, 2) NOT NULL,
  `descuento` DECIMAL(12, 2) NOT NULL DEFAULT 0,
  `montoTotal` DECIMAL(12, 2) NOT NULL,
  `diasCongelados` INTEGER NOT NULL DEFAULT 0,
  `estado` ENUM('ACTIVA', 'CANCELADA') NOT NULL DEFAULT 'ACTIVA',
  `abonoDayPassId` INTEGER NULL,
  `vendidaPorId` INTEGER NULL,
  `notas` VARCHAR(255) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `membresias_abonoDayPassId_key`(`abonoDayPassId`),
  INDEX `membresias_socioId_fechaFinAjustada_idx`(`socioId`, `fechaFinAjustada`),
  INDEX `membresias_planId_idx`(`planId`),
  INDEX `membresias_vendidaPorId_idx`(`vendidaPorId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ─── congelamientos: pausas que extienden la vigencia ───────────────────────
CREATE TABLE `congelamientos` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `membresiaId` INTEGER NOT NULL,
  `fechaInicio` DATE NOT NULL,
  `fechaFin` DATE NOT NULL,
  `dias` INTEGER NOT NULL,
  `motivo` VARCHAR(255) NOT NULL,
  `creadoPorId` INTEGER NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  INDEX `congelamientos_membresiaId_idx`(`membresiaId`),
  INDEX `congelamientos_creadoPorId_idx`(`creadoPorId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ─── invitados: pases de cortesía ───────────────────────────────────────────
CREATE TABLE `invitados` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `socioId` INTEGER NOT NULL,
  `membresiaId` INTEGER NOT NULL,
  `nombre` VARCHAR(120) NOT NULL,
  `documento` VARCHAR(30) NOT NULL,
  `telefono` VARCHAR(30) NULL,
  `fecha` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `registradoPorId` INTEGER NULL,

  INDEX `invitados_socioId_fecha_idx`(`socioId`, `fecha`),
  INDEX `invitados_membresiaId_idx`(`membresiaId`),
  INDEX `invitados_registradoPorId_idx`(`registradoPorId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ─── cajas_turno: apertura y cierre de caja por turno ───────────────────────
CREATE TABLE `cajas_turno` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `usuarioId` INTEGER NOT NULL,
  `turno` ENUM('MANANA', 'TARDE', 'NOCHE') NOT NULL,
  `estado` ENUM('ABIERTA', 'CERRADA') NOT NULL DEFAULT 'ABIERTA',
  `apertura` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `cierre` DATETIME(3) NULL,
  `montoInicial` DECIMAL(12, 2) NOT NULL DEFAULT 0,
  `totalEfectivo` DECIMAL(12, 2) NOT NULL DEFAULT 0,
  `totalTarjeta` DECIMAL(12, 2) NOT NULL DEFAULT 0,
  `totalTransferencia` DECIMAL(12, 2) NOT NULL DEFAULT 0,
  `efectivoContado` DECIMAL(12, 2) NULL,
  `diferencia` DECIMAL(12, 2) NULL,
  `observaciones` VARCHAR(255) NULL,

  INDEX `cajas_turno_usuarioId_estado_idx`(`usuarioId`, `estado`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ─── pagos: abonos y pagos totales ──────────────────────────────────────────
CREATE TABLE `pagos` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `socioId` INTEGER NOT NULL,
  `membresiaId` INTEGER NULL,
  `cajaId` INTEGER NULL,
  `usuarioId` INTEGER NULL,
  `monto` DECIMAL(12, 2) NOT NULL,
  `metodo` ENUM('EFECTIVO', 'TARJETA', 'TRANSFERENCIA') NOT NULL,
  `concepto` ENUM('MEMBRESIA', 'ABONO', 'OTRO') NOT NULL DEFAULT 'MEMBRESIA',
  `referencia` VARCHAR(80) NULL,
  `nota` VARCHAR(255) NULL,
  `fecha` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  INDEX `pagos_fecha_idx`(`fecha`),
  INDEX `pagos_socioId_idx`(`socioId`),
  INDEX `pagos_membresiaId_idx`(`membresiaId`),
  INDEX `pagos_cajaId_idx`(`cajaId`),
  INDEX `pagos_usuarioId_idx`(`usuarioId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ─── accesos: bitácora del torniquete ───────────────────────────────────────
CREATE TABLE `accesos` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `socioId` INTEGER NULL,
  `valorIngresado` VARCHAR(80) NOT NULL,
  `metodo` ENUM('DOCUMENTO', 'QR') NOT NULL,
  `tipo` ENUM('SOCIO', 'INVITADO') NOT NULL DEFAULT 'SOCIO',
  `resultado` ENUM('PERMITIDO', 'DENEGADO') NOT NULL,
  `motivo` VARCHAR(255) NULL,
  `fecha` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `usuarioId` INTEGER NULL,

  INDEX `accesos_fecha_idx`(`fecha`),
  INDEX `accesos_socioId_fecha_idx`(`socioId`, `fecha`),
  INDEX `accesos_usuarioId_idx`(`usuarioId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ─── clases_grupales: horario semanal ───────────────────────────────────────
CREATE TABLE `clases_grupales` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `nombre` VARCHAR(80) NOT NULL,
  `disciplina` VARCHAR(40) NOT NULL,
  `instructorId` INTEGER NULL,
  `diaSemana` INTEGER NOT NULL,
  `horaInicio` VARCHAR(5) NOT NULL,
  `horaFin` VARCHAR(5) NOT NULL,
  `aforoMax` INTEGER NOT NULL,
  `sala` VARCHAR(40) NOT NULL,
  `activa` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  INDEX `clases_grupales_diaSemana_idx`(`diaSemana`),
  INDEX `clases_grupales_instructorId_idx`(`instructorId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ─── reservas: cupos por sesión ─────────────────────────────────────────────
CREATE TABLE `reservas` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `claseId` INTEGER NOT NULL,
  `socioId` INTEGER NOT NULL,
  `fecha` DATE NOT NULL,
  `estado` ENUM('CONFIRMADA', 'CANCELADA', 'ASISTIO') NOT NULL DEFAULT 'CONFIRMADA',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `reservas_claseId_socioId_fecha_key`(`claseId`, `socioId`, `fecha`),
  INDEX `reservas_socioId_idx`(`socioId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ─── evaluaciones_fisicas: valoraciones de instructores ─────────────────────
CREATE TABLE `evaluaciones_fisicas` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `socioId` INTEGER NOT NULL,
  `instructorId` INTEGER NULL,
  `fecha` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `pesoKg` DECIMAL(5, 2) NOT NULL,
  `estaturaCm` DECIMAL(5, 2) NOT NULL,
  `grasaCorporal` DECIMAL(5, 2) NULL,
  `masaMuscular` DECIMAL(5, 2) NULL,
  `notas` TEXT NULL,

  INDEX `evaluaciones_fisicas_socioId_idx`(`socioId`),
  INDEX `evaluaciones_fisicas_instructorId_idx`(`instructorId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ─── Llaves foráneas ────────────────────────────────────────────────────────
ALTER TABLE `membresias` ADD CONSTRAINT `membresias_socioId_fkey` FOREIGN KEY (`socioId`) REFERENCES `socios`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `membresias` ADD CONSTRAINT `membresias_planId_fkey` FOREIGN KEY (`planId`) REFERENCES `planes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `membresias` ADD CONSTRAINT `membresias_vendidaPorId_fkey` FOREIGN KEY (`vendidaPorId`) REFERENCES `usuarios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `membresias` ADD CONSTRAINT `membresias_abonoDayPassId_fkey` FOREIGN KEY (`abonoDayPassId`) REFERENCES `membresias`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `congelamientos` ADD CONSTRAINT `congelamientos_membresiaId_fkey` FOREIGN KEY (`membresiaId`) REFERENCES `membresias`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `congelamientos` ADD CONSTRAINT `congelamientos_creadoPorId_fkey` FOREIGN KEY (`creadoPorId`) REFERENCES `usuarios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `invitados` ADD CONSTRAINT `invitados_socioId_fkey` FOREIGN KEY (`socioId`) REFERENCES `socios`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `invitados` ADD CONSTRAINT `invitados_membresiaId_fkey` FOREIGN KEY (`membresiaId`) REFERENCES `membresias`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `invitados` ADD CONSTRAINT `invitados_registradoPorId_fkey` FOREIGN KEY (`registradoPorId`) REFERENCES `usuarios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `cajas_turno` ADD CONSTRAINT `cajas_turno_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `pagos` ADD CONSTRAINT `pagos_socioId_fkey` FOREIGN KEY (`socioId`) REFERENCES `socios`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `pagos` ADD CONSTRAINT `pagos_membresiaId_fkey` FOREIGN KEY (`membresiaId`) REFERENCES `membresias`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `pagos` ADD CONSTRAINT `pagos_cajaId_fkey` FOREIGN KEY (`cajaId`) REFERENCES `cajas_turno`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `pagos` ADD CONSTRAINT `pagos_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `usuarios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `accesos` ADD CONSTRAINT `accesos_socioId_fkey` FOREIGN KEY (`socioId`) REFERENCES `socios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `accesos` ADD CONSTRAINT `accesos_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `usuarios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `clases_grupales` ADD CONSTRAINT `clases_grupales_instructorId_fkey` FOREIGN KEY (`instructorId`) REFERENCES `usuarios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `reservas` ADD CONSTRAINT `reservas_claseId_fkey` FOREIGN KEY (`claseId`) REFERENCES `clases_grupales`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `reservas` ADD CONSTRAINT `reservas_socioId_fkey` FOREIGN KEY (`socioId`) REFERENCES `socios`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `evaluaciones_fisicas` ADD CONSTRAINT `evaluaciones_fisicas_socioId_fkey` FOREIGN KEY (`socioId`) REFERENCES `socios`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `evaluaciones_fisicas` ADD CONSTRAINT `evaluaciones_fisicas_instructorId_fkey` FOREIGN KEY (`instructorId`) REFERENCES `usuarios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── Vista de apoyo para reportes en Workbench ──────────────────────────────
CREATE OR REPLACE VIEW `v_saldos_membresias` AS
SELECT
  m.id                                   AS membresiaId,
  s.documento,
  CONCAT(s.nombres, ' ', s.apellidos)    AS socio,
  p.nombre                               AS plan,
  m.fechaInicio,
  m.fechaFinAjustada,
  m.montoTotal,
  COALESCE(SUM(pg.monto), 0)             AS pagado,
  m.montoTotal - COALESCE(SUM(pg.monto), 0) AS saldoPendiente
FROM membresias m
JOIN socios s ON s.id = m.socioId
JOIN planes p ON p.id = m.planId
LEFT JOIN pagos pg ON pg.membresiaId = m.id
WHERE m.estado = 'ACTIVA'
GROUP BY m.id, s.documento, s.nombres, s.apellidos, p.nombre, m.fechaInicio, m.fechaFinAjustada, m.montoTotal;
