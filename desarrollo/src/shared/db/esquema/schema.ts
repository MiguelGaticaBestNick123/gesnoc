import {
  pgTable,
  pgSchema,
  unique,
  check,
  integer,
  text,
  boolean,
  smallint,
  timestamp,
  index,
  foreignKey,
  uniqueIndex,
  date,
  primaryKey,
  uuid,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { customType } from 'drizzle-orm/pg-core';

const bytea = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => 'bytea' });

export const gesnoc = pgSchema('gesnoc');

export const usuario = gesnoc.table(
  'usuario',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity({
      name: 'usuario_id_seq',
      startWith: 1,
      increment: 1,
      minValue: 1,
      maxValue: 2147483647,
      cache: 1,
    }),
    nombre: text().notNull(),
    correo: text().notNull(),
    claveHash: text('clave_hash').notNull(),
    esAdministrador: boolean('es_administrador').default(false).notNull(),
    activo: boolean().default(true).notNull(),
    intentosFallidos: smallint('intentos_fallidos').default(0).notNull(),
    bloqueadoHasta: timestamp('bloqueado_hasta', { withTimezone: true, mode: 'string' }),
  },
  (table) => [
    unique('usuario_correo_uq').on(table.correo),
    check(
      'usuario_nombre_check',
      sql`(length(TRIM(BOTH FROM nombre)) >= 2) AND (length(TRIM(BOTH FROM nombre)) <= 80)`,
    ),
    check(
      'usuario_correo_check',
      sql`(correo = lower(correo)) AND (correo ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'::text)`,
    ),
    check(
      'usuario_intentos_fallidos_check',
      sql`(intentos_fallidos >= 0) AND (intentos_fallidos <= 100)`,
    ),
  ],
);

export const sesion = gesnoc.table(
  'sesion',
  {
    tokenHash: bytea('token_hash').primaryKey().notNull(),
    usuarioId: integer('usuario_id').notNull(),
    expiraEn: timestamp('expira_en', { withTimezone: true, mode: 'string' }).notNull(),
  },
  (table) => [
    index('sesion_usuario_ix').using('btree', table.usuarioId.asc().nullsLast().op('int4_ops')),
    foreignKey({
      columns: [table.usuarioId],
      foreignColumns: [usuario.id],
      name: 'sesion_usuario_id_fkey',
    }).onDelete('cascade'),
    check('sesion_token_hash_check', sql`octet_length(token_hash) = 32`),
  ],
);

export const ambiente = gesnoc.table(
  'ambiente',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity({
      name: 'ambiente_id_seq',
      startWith: 1,
      increment: 1,
      minValue: 1,
      maxValue: 2147483647,
      cache: 1,
    }),
    nombre: text().notNull(),
    planoAncho: integer('plano_ancho').notNull(),
    planoAlto: integer('plano_alto').notNull(),
    activo: boolean().default(true).notNull(),
  },
  (table) => [
    uniqueIndex('ambiente_nombre_uq').using('btree', sql`lower(nombre)`),
    check(
      'ambiente_nombre_check',
      sql`(length(TRIM(BOTH FROM nombre)) >= 2) AND (length(TRIM(BOTH FROM nombre)) <= 40)`,
    ),
    check('ambiente_plano_ancho_check', sql`(plano_ancho >= 200) AND (plano_ancho <= 5000)`),
    check('ambiente_plano_alto_check', sql`(plano_alto >= 200) AND (plano_alto <= 5000)`),
  ],
);

export const mesa = gesnoc.table(
  'mesa',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity({
      name: 'mesa_id_seq',
      startWith: 1,
      increment: 1,
      minValue: 1,
      maxValue: 2147483647,
      cache: 1,
    }),
    ambienteId: integer('ambiente_id').notNull(),
    numero: smallint().notNull(),
    forma: text().notNull(),
    posX: integer('pos_x').notNull(),
    posY: integer('pos_y').notNull(),
    ancho: integer().notNull(),
    alto: integer().notNull(),
    rotacion: smallint().default(0).notNull(),
    activa: boolean().default(true).notNull(),
    tokenQr: text('token_qr').notNull(),
    sillas: smallint(),
  },
  (table) => [
    uniqueIndex('mesa_numero_uq')
      .using(
        'btree',
        table.ambienteId.asc().nullsLast().op('int4_ops'),
        table.numero.asc().nullsLast().op('int4_ops'),
      )
      .where(sql`activa`),
    foreignKey({
      columns: [table.ambienteId],
      foreignColumns: [ambiente.id],
      name: 'mesa_ambiente_id_fkey',
    }),
    unique('mesa_token_qr_uq').on(table.tokenQr),
    check('mesa_numero_check', sql`(numero >= 1) AND (numero <= 999)`),
    check(
      'mesa_forma_check',
      sql`forma = ANY (ARRAY['cuadrada'::text, 'redonda'::text, 'rectangular'::text])`,
    ),
    check('mesa_pos_x_check', sql`pos_x >= 0`),
    check('mesa_pos_y_check', sql`pos_y >= 0`),
    check('mesa_ancho_check', sql`(ancho >= 20) AND (ancho <= 400)`),
    check('mesa_alto_check', sql`(alto >= 20) AND (alto <= 400)`),
    check('mesa_rotacion_check', sql`(rotacion >= 0) AND (rotacion <= 359)`),
    check('mesa_token_qr_check', sql`token_qr ~ '^[A-Za-z0-9_-]{22,64}$'::text`),
    check('mesa_sillas_ck', sql`(sillas >= 0) AND (sillas <= 20)`),
    check('mesa_proporcion_ck', sql`(forma = 'rectangular'::text) OR (ancho = alto)`),
  ],
);

export const estacion = gesnoc.table(
  'estacion',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity({
      name: 'estacion_id_seq',
      startWith: 1,
      increment: 1,
      minValue: 1,
      maxValue: 2147483647,
      cache: 1,
    }),
    ambienteId: integer('ambiente_id').notNull(),
    nombre: text().notNull(),
    tipo: text().notNull(),
  },
  (table) => [
    uniqueIndex('estacion_barra_uq')
      .using('btree', table.ambienteId.asc().nullsLast().op('int4_ops'))
      .where(sql`(tipo = 'barra'::text)`),
    uniqueIndex('estacion_nombre_uq').using('btree', sql`lower(nombre)`),
    foreignKey({
      columns: [table.ambienteId],
      foreignColumns: [ambiente.id],
      name: 'estacion_ambiente_id_fkey',
    }),
    check(
      'estacion_nombre_check',
      sql`(length(TRIM(BOTH FROM nombre)) >= 2) AND (length(TRIM(BOTH FROM nombre)) <= 40)`,
    ),
    check('estacion_tipo_check', sql`tipo = ANY (ARRAY['barra'::text, 'cocina'::text])`),
  ],
);

export const categoria = gesnoc.table(
  'categoria',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity({
      name: 'categoria_id_seq',
      startWith: 1,
      increment: 1,
      minValue: 1,
      maxValue: 2147483647,
      cache: 1,
    }),
    nombre: text().notNull(),
    reglaRuteo: text('regla_ruteo').notNull(),
    estacionId: integer('estacion_id'),
  },
  (table) => [
    uniqueIndex('categoria_nombre_uq').using('btree', sql`lower(nombre)`),
    foreignKey({
      columns: [table.estacionId],
      foreignColumns: [estacion.id],
      name: 'categoria_estacion_id_fkey',
    }),
    check(
      'categoria_nombre_check',
      sql`(length(TRIM(BOTH FROM nombre)) >= 2) AND (length(TRIM(BOTH FROM nombre)) <= 40)`,
    ),
    check(
      'categoria_regla_ruteo_check',
      sql`regla_ruteo = ANY (ARRAY['fija'::text, 'barra_ambiente'::text])`,
    ),
    check('categoria_ruteo_ck', sql`(regla_ruteo = 'fija'::text) = (estacion_id IS NOT NULL)`),
  ],
);

export const producto = gesnoc.table(
  'producto',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity({
      name: 'producto_id_seq',
      startWith: 1,
      increment: 1,
      minValue: 1,
      maxValue: 2147483647,
      cache: 1,
    }),
    categoriaId: integer('categoria_id').notNull(),
    nombre: text().notNull(),
    precio: integer().notNull(),
    estacionId: integer('estacion_id'),
    activo: boolean().default(true).notNull(),
  },
  (table) => [
    index('producto_categoria_ix').using(
      'btree',
      table.categoriaId.asc().nullsLast().op('int4_ops'),
    ),
    uniqueIndex('producto_nombre_uq').using('btree', sql`lower(nombre)`),
    foreignKey({
      columns: [table.categoriaId],
      foreignColumns: [categoria.id],
      name: 'producto_categoria_id_fkey',
    }),
    foreignKey({
      columns: [table.estacionId],
      foreignColumns: [estacion.id],
      name: 'producto_estacion_id_fkey',
    }),
    check(
      'producto_nombre_check',
      sql`(length(TRIM(BOTH FROM nombre)) >= 2) AND (length(TRIM(BOTH FROM nombre)) <= 80)`,
    ),
    check('producto_precio_check', sql`precio > 0`),
  ],
);

export const noche = gesnoc.table(
  'noche',
  {
    fecha: date().primaryKey().notNull(),
    nota: text(),
    precioEntrada: integer('precio_entrada').notNull(),
    abiertaEn: timestamp('abierta_en', { withTimezone: true, mode: 'string' }),
    cerradaEn: timestamp('cerrada_en', { withTimezone: true, mode: 'string' }),
  },
  (table) => [
    uniqueIndex('noche_una_abierta_uq')
      .using('btree', sql`(true)`)
      .where(sql`((abierta_en IS NOT NULL) AND (cerrada_en IS NULL))`),
    check('noche_nota_check', sql`length(nota) <= 280`),
    check('noche_precio_entrada_check', sql`precio_entrada >= 0`),
    check(
      'noche_ciclo_ck',
      sql`(cerrada_en IS NULL) OR ((abierta_en IS NOT NULL) AND (cerrada_en > abierta_en))`,
    ),
  ],
);

export const cliente = gesnoc.table(
  'cliente',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity({
      name: 'cliente_id_seq',
      startWith: 1,
      increment: 1,
      minValue: 1,
      maxValue: 2147483647,
      cache: 1,
    }),
    documento: text().notNull(),
    nombre: text().notNull(),
    apellido: text().notNull(),
  },
  (table) => [
    unique('cliente_documento_uq').on(table.documento),
    check('cliente_documento_check', sql`documento ~ '^[0-9A-Z]{4,15}(-[0-9K])?$'::text`),
    check(
      'cliente_nombre_check',
      sql`(length(TRIM(BOTH FROM nombre)) >= 1) AND (length(TRIM(BOTH FROM nombre)) <= 60)`,
    ),
    check(
      'cliente_apellido_check',
      sql`(length(TRIM(BOTH FROM apellido)) >= 1) AND (length(TRIM(BOTH FROM apellido)) <= 60)`,
    ),
  ],
);

export const invitado = gesnoc.table(
  'invitado',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity({
      name: 'invitado_id_seq',
      startWith: 1,
      increment: 1,
      minValue: 1,
      maxValue: 2147483647,
      cache: 1,
    }),
    nombre: text().notNull(),
    documento: text(),
    nota: text(),
    activo: boolean().default(true).notNull(),
  },
  (table) => [
    uniqueIndex('invitado_documento_uq')
      .using('btree', table.documento.asc().nullsLast().op('text_ops'))
      .where(sql`(activo AND (documento IS NOT NULL))`),
    check(
      'invitado_nombre_check',
      sql`(length(TRIM(BOTH FROM nombre)) >= 2) AND (length(TRIM(BOTH FROM nombre)) <= 80)`,
    ),
    check('invitado_documento_check', sql`documento ~ '^[0-9A-Z]{4,15}(-[0-9K])?$'::text`),
    check('invitado_nota_check', sql`length(nota) <= 280`),
  ],
);

export const arqueo = gesnoc.table(
  'arqueo',
  {
    fecha: date().primaryKey().notNull(),
    fondoInicial: integer('fondo_inicial').notNull(),
    efectivoContado: integer('efectivo_contado'),
    nota: text(),
    contadoPor: integer('contado_por'),
  },
  (table) => [
    foreignKey({
      columns: [table.fecha],
      foreignColumns: [noche.fecha],
      name: 'arqueo_fecha_fkey',
    }),
    foreignKey({
      columns: [table.contadoPor],
      foreignColumns: [usuario.id],
      name: 'arqueo_contado_por_fkey',
    }),
    check('arqueo_nota_check', sql`length(nota) <= 500`),
    check('arqueo_conteo_ck', sql`(efectivo_contado IS NULL) = (contado_por IS NULL)`),
    check('arqueo_fondo_inicial_check', sql`fondo_inicial >= 0`),
    check('arqueo_efectivo_contado_check', sql`efectivo_contado >= 0`),
  ],
);

export const disponibilidad = gesnoc.table(
  'disponibilidad',
  {
    fecha: date().notNull(),
    usuarioId: integer('usuario_id').notNull(),
  },
  (table) => [
    index('disponibilidad_usuario_ix').using(
      'btree',
      table.usuarioId.asc().nullsLast().op('int4_ops'),
    ),
    foreignKey({
      columns: [table.fecha],
      foreignColumns: [noche.fecha],
      name: 'disponibilidad_fecha_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.usuarioId],
      foreignColumns: [usuario.id],
      name: 'disponibilidad_usuario_id_fkey',
    }),
    primaryKey({ columns: [table.fecha, table.usuarioId], name: 'disponibilidad_pkey' }),
  ],
);

export const asignacion = gesnoc.table(
  'asignacion',
  {
    fecha: date().notNull(),
    usuarioId: integer('usuario_id').notNull(),
    rol: text().notNull(),
    ambienteId: integer('ambiente_id'),
  },
  (table) => [
    index('asignacion_usuario_ix').using('btree', table.usuarioId.asc().nullsLast().op('int4_ops')),
    foreignKey({
      columns: [table.fecha],
      foreignColumns: [noche.fecha],
      name: 'asignacion_fecha_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.usuarioId],
      foreignColumns: [usuario.id],
      name: 'asignacion_usuario_id_fkey',
    }),
    foreignKey({
      columns: [table.ambienteId],
      foreignColumns: [ambiente.id],
      name: 'asignacion_ambiente_id_fkey',
    }),
    primaryKey({ columns: [table.fecha, table.usuarioId], name: 'asignacion_pkey' }),
    check(
      'asignacion_rol_check',
      sql`rol = ANY (ARRAY['garzon'::text, 'barman'::text, 'cocinero'::text, 'guardia'::text])`,
    ),
    check('asignacion_ambiente_ck', sql`(rol = 'guardia'::text) = (ambiente_id IS NULL)`),
  ],
);

export const comanda = gesnoc.table(
  'comanda',
  {
    fecha: date().notNull(),
    pedidoNumero: integer('pedido_numero').notNull(),
    estacionId: integer('estacion_id').notNull(),
    listaEn: timestamp('lista_en', { withTimezone: true, mode: 'string' }),
    entregadaEn: timestamp('entregada_en', { withTimezone: true, mode: 'string' }),
  },
  (table) => [
    index('comanda_cola_ix')
      .using(
        'btree',
        table.estacionId.asc().nullsLast().op('date_ops'),
        table.fecha.asc().nullsLast().op('date_ops'),
      )
      .where(sql`(entregada_en IS NULL)`),
    foreignKey({
      columns: [table.estacionId],
      foreignColumns: [estacion.id],
      name: 'comanda_estacion_id_fkey',
    }),
    foreignKey({
      columns: [table.fecha, table.pedidoNumero],
      foreignColumns: [pedido.fecha, pedido.numero],
      name: 'comanda_pedido_fk',
    }).onDelete('cascade'),
    primaryKey({
      columns: [table.estacionId, table.fecha, table.pedidoNumero],
      name: 'comanda_pkey',
    }),
    check(
      'comanda_ciclo_ck',
      sql`(entregada_en IS NULL) OR ((lista_en IS NOT NULL) AND (entregada_en >= lista_en))`,
    ),
  ],
);

export const sorteo = gesnoc.table(
  'sorteo',
  {
    fecha: date().notNull(),
    ambienteId: integer('ambiente_id').notNull(),
    premio: text().notNull(),
    ticketGanador: integer('ticket_ganador').notNull(),
    realizadoPor: integer('realizado_por').notNull(),
    realizadoEn: timestamp('realizado_en', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.fecha],
      foreignColumns: [noche.fecha],
      name: 'sorteo_fecha_fkey',
    }),
    foreignKey({
      columns: [table.ambienteId],
      foreignColumns: [ambiente.id],
      name: 'sorteo_ambiente_id_fkey',
    }),
    foreignKey({
      columns: [table.realizadoPor],
      foreignColumns: [usuario.id],
      name: 'sorteo_realizado_por_fkey',
    }),
    foreignKey({
      columns: [table.fecha, table.ticketGanador],
      foreignColumns: [entrada.fecha, entrada.ticket],
      name: 'sorteo_ganador_fk',
    }),
    primaryKey({ columns: [table.ambienteId, table.fecha], name: 'sorteo_pkey' }),
    unique('sorteo_ganador_uq').on(table.fecha, table.ticketGanador),
    check(
      'sorteo_premio_check',
      sql`(length(TRIM(BOTH FROM premio)) >= 2) AND (length(TRIM(BOTH FROM premio)) <= 80)`,
    ),
  ],
);

export const llamado = gesnoc.table(
  'llamado',
  {
    fecha: date().notNull(),
    numero: integer().notNull(),
    mesaId: integer('mesa_id').notNull(),
    creadoEn: timestamp('creado_en', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
    atendidoPor: integer('atendido_por'),
    atendidoEn: timestamp('atendido_en', { withTimezone: true, mode: 'string' }),
  },
  (table) => [
    index('llamado_mesa_ix').using(
      'btree',
      table.mesaId.asc().nullsLast().op('int4_ops'),
      table.creadoEn.asc().nullsLast().op('timestamptz_ops'),
    ),
    uniqueIndex('llamado_pendiente_uq')
      .using(
        'btree',
        table.fecha.asc().nullsLast().op('int4_ops'),
        table.mesaId.asc().nullsLast().op('int4_ops'),
      )
      .where(sql`(atendido_en IS NULL)`),
    foreignKey({
      columns: [table.fecha],
      foreignColumns: [noche.fecha],
      name: 'llamado_fecha_fkey',
    }),
    foreignKey({
      columns: [table.mesaId],
      foreignColumns: [mesa.id],
      name: 'llamado_mesa_id_fkey',
    }),
    foreignKey({
      columns: [table.atendidoPor],
      foreignColumns: [usuario.id],
      name: 'llamado_atendido_por_fkey',
    }),
    primaryKey({ columns: [table.fecha, table.numero], name: 'llamado_pkey' }),
    check('llamado_numero_check', sql`numero > 0`),
    check('llamado_atencion_ck', sql`(atendido_en IS NULL) = (atendido_por IS NULL)`),
    check('llamado_atencion_orden_ck', sql`(atendido_en IS NULL) OR (atendido_en >= creado_en)`),
  ],
);

export const pedido = gesnoc.table(
  'pedido',
  {
    fecha: date().notNull(),
    numero: integer().notNull(),
    cuentaNumero: integer('cuenta_numero').notNull(),
    tomadoPor: integer('tomado_por').notNull(),
    enviadoEn: timestamp('enviado_en', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    personas: smallint(),
    claveEnvio: uuid('clave_envio').notNull(),
  },
  (table) => [
    index('pedido_cuenta_ix').using(
      'btree',
      table.fecha.asc().nullsLast().op('date_ops'),
      table.cuentaNumero.asc().nullsLast().op('date_ops'),
    ),
    foreignKey({
      columns: [table.fecha],
      foreignColumns: [noche.fecha],
      name: 'pedido_fecha_fkey',
    }),
    foreignKey({
      columns: [table.tomadoPor],
      foreignColumns: [usuario.id],
      name: 'pedido_tomado_por_fkey',
    }),
    foreignKey({
      columns: [table.fecha, table.cuentaNumero],
      foreignColumns: [cuenta.fecha, cuenta.numero],
      name: 'pedido_cuenta_fk',
    }),
    primaryKey({ columns: [table.fecha, table.numero], name: 'pedido_pkey' }),
    unique('pedido_clave_envio_uq').on(table.claveEnvio),
    check('pedido_numero_check', sql`numero > 0`),
    check('pedido_personas_check', sql`(personas >= 1) AND (personas <= 50)`),
  ],
);

export const reporte = gesnoc.table(
  'reporte',
  {
    clienteId: integer('cliente_id').notNull(),
    numero: smallint().notNull(),
    fecha: date().notNull(),
    tipo: text().notNull(),
    descripcion: text().notNull(),
    registradoPor: integer('registrado_por').notNull(),
    registradoEn: timestamp('registrado_en', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('reporte_fecha_ix').using('btree', table.fecha.asc().nullsLast().op('date_ops')),
    foreignKey({
      columns: [table.clienteId],
      foreignColumns: [cliente.id],
      name: 'reporte_cliente_id_fkey',
    }),
    foreignKey({
      columns: [table.fecha],
      foreignColumns: [noche.fecha],
      name: 'reporte_fecha_fkey',
    }),
    foreignKey({
      columns: [table.registradoPor],
      foreignColumns: [usuario.id],
      name: 'reporte_registrado_por_fkey',
    }),
    primaryKey({ columns: [table.clienteId, table.numero], name: 'reporte_pkey' }),
    check('reporte_numero_check', sql`(numero >= 1) AND (numero <= 999)`),
    check(
      'reporte_tipo_check',
      sql`tipo = ANY (ARRAY['advertencia'::text, 'expulsion'::text, 'observacion'::text])`,
    ),
    check(
      'reporte_descripcion_check',
      sql`(length(TRIM(BOTH FROM descripcion)) >= 2) AND (length(TRIM(BOTH FROM descripcion)) <= 1000)`,
    ),
  ],
);

export const entrada = gesnoc.table(
  'entrada',
  {
    fecha: date().notNull(),
    clienteId: integer('cliente_id').notNull(),
    monto: integer().notNull(),
    medioPago: text('medio_pago'),
    ticket: integer(),
    registradaPor: integer('registrada_por').notNull(),
    registradaEn: timestamp('registrada_en', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    invitadoId: integer('invitado_id'),
  },
  (table) => [
    index('entrada_cliente_ix').using('btree', table.clienteId.asc().nullsLast().op('int4_ops')),
    index('entrada_invitado_ix')
      .using('btree', table.invitadoId.asc().nullsLast().op('int4_ops'))
      .where(sql`(invitado_id IS NOT NULL)`),
    foreignKey({
      columns: [table.fecha],
      foreignColumns: [noche.fecha],
      name: 'entrada_fecha_fkey',
    }),
    foreignKey({
      columns: [table.clienteId],
      foreignColumns: [cliente.id],
      name: 'entrada_cliente_id_fkey',
    }),
    foreignKey({
      columns: [table.registradaPor],
      foreignColumns: [usuario.id],
      name: 'entrada_registrada_por_fkey',
    }),
    foreignKey({
      columns: [table.invitadoId],
      foreignColumns: [invitado.id],
      name: 'entrada_invitado_id_fkey',
    }),
    primaryKey({ columns: [table.clienteId, table.fecha], name: 'entrada_pkey' }),
    unique('entrada_ticket_uq').on(table.fecha, table.ticket),
    check('entrada_ticket_check', sql`ticket > 0`),
    check('entrada_monto_check', sql`monto >= 0`),
    check(
      'entrada_medio_pago_check',
      sql`medio_pago = ANY (ARRAY['efectivo'::text, 'tarjeta'::text, 'transferencia'::text])`,
    ),
    check(
      'entrada_pago_ck',
      sql`((monto = 0) AND (medio_pago IS NULL) AND (ticket IS NULL)) OR ((monto > 0) AND (medio_pago IS NOT NULL) AND (ticket IS NOT NULL))`,
    ),
    check(
      'entrada_invitado_ck',
      sql`(invitado_id IS NULL) OR ((monto = 0) AND (medio_pago IS NULL) AND (ticket IS NULL))`,
    ),
  ],
);

export const cuenta = gesnoc.table(
  'cuenta',
  {
    fecha: date().notNull(),
    numero: integer().notNull(),
    mesaId: integer('mesa_id'),
    ambienteId: integer('ambiente_id'),
    referencia: text(),
    abiertaPor: integer('abierta_por').notNull(),
    abiertaEn: timestamp('abierta_en', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    cerradaPor: integer('cerrada_por'),
    cerradaEn: timestamp('cerrada_en', { withTimezone: true, mode: 'string' }),
  },
  (table) => [
    uniqueIndex('cuenta_mesa_abierta_uq')
      .using('btree', table.mesaId.asc().nullsLast().op('int4_ops'))
      .where(sql`(cerrada_en IS NULL)`),
    foreignKey({
      columns: [table.fecha],
      foreignColumns: [noche.fecha],
      name: 'cuenta_fecha_fkey',
    }),
    foreignKey({
      columns: [table.mesaId],
      foreignColumns: [mesa.id],
      name: 'cuenta_mesa_id_fkey',
    }),
    foreignKey({
      columns: [table.ambienteId],
      foreignColumns: [ambiente.id],
      name: 'cuenta_ambiente_id_fkey',
    }),
    foreignKey({
      columns: [table.abiertaPor],
      foreignColumns: [usuario.id],
      name: 'cuenta_abierta_por_fkey',
    }),
    foreignKey({
      columns: [table.cerradaPor],
      foreignColumns: [usuario.id],
      name: 'cuenta_cerrada_por_fkey',
    }),
    primaryKey({ columns: [table.fecha, table.numero], name: 'cuenta_pkey' }),
    check('cuenta_numero_check', sql`numero > 0`),
    check(
      'cuenta_referencia_check',
      sql`(length(TRIM(BOTH FROM referencia)) >= 1) AND (length(TRIM(BOTH FROM referencia)) <= 60)`,
    ),
    check(
      'cuenta_ubicacion_ck',
      sql`((mesa_id IS NOT NULL) AND (ambiente_id IS NULL) AND (referencia IS NULL)) OR ((mesa_id IS NULL) AND (ambiente_id IS NOT NULL) AND (referencia IS NOT NULL))`,
    ),
    check('cuenta_cierre_ck', sql`(cerrada_en IS NULL) = (cerrada_por IS NULL)`),
    check('cuenta_cierre_orden_ck', sql`(cerrada_en IS NULL) OR (cerrada_en >= abierta_en)`),
  ],
);

export const detallePedido = gesnoc.table(
  'detalle_pedido',
  {
    fecha: date().notNull(),
    pedidoNumero: integer('pedido_numero').notNull(),
    linea: smallint().notNull(),
    productoId: integer('producto_id').notNull(),
    estacionId: integer('estacion_id').notNull(),
    cantidad: smallint().notNull(),
    precioUnitario: integer('precio_unitario').notNull(),
    nota: text(),
    anuladoPor: integer('anulado_por'),
    anuladoEn: timestamp('anulado_en', { withTimezone: true, mode: 'string' }),
  },
  (table) => [
    index('detalle_comanda_ix').using(
      'btree',
      table.fecha.asc().nullsLast().op('date_ops'),
      table.pedidoNumero.asc().nullsLast().op('int4_ops'),
      table.estacionId.asc().nullsLast().op('date_ops'),
    ),
    foreignKey({
      columns: [table.productoId],
      foreignColumns: [producto.id],
      name: 'detalle_pedido_producto_id_fkey',
    }),
    foreignKey({
      columns: [table.anuladoPor],
      foreignColumns: [usuario.id],
      name: 'detalle_pedido_anulado_por_fkey',
    }),
    foreignKey({
      columns: [table.fecha, table.pedidoNumero],
      foreignColumns: [pedido.fecha, pedido.numero],
      name: 'detalle_pedido_fk',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.fecha, table.pedidoNumero, table.estacionId],
      foreignColumns: [comanda.estacionId, comanda.fecha, comanda.pedidoNumero],
      name: 'detalle_comanda_fk',
    }).onDelete('cascade'),
    primaryKey({
      columns: [table.fecha, table.linea, table.pedidoNumero],
      name: 'detalle_pedido_pkey',
    }),
    check('detalle_pedido_linea_check', sql`(linea >= 1) AND (linea <= 200)`),
    check('detalle_pedido_cantidad_check', sql`(cantidad >= 1) AND (cantidad <= 99)`),
    check('detalle_pedido_precio_unitario_check', sql`precio_unitario > 0`),
    check('detalle_pedido_nota_check', sql`length(nota) <= 140`),
    check('detalle_anulacion_ck', sql`(anulado_en IS NULL) = (anulado_por IS NULL)`),
  ],
);

export const pago = gesnoc.table(
  'pago',
  {
    fecha: date().notNull(),
    cuentaNumero: integer('cuenta_numero').notNull(),
    numero: smallint().notNull(),
    medio: text().notNull(),
    monto: integer().notNull(),
    propina: integer().default(0).notNull(),
    registradoPor: integer('registrado_por').notNull(),
    registradoEn: timestamp('registrado_en', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    confirmadoPor: integer('confirmado_por'),
    confirmadoEn: timestamp('confirmado_en', { withTimezone: true, mode: 'string' }),
    claveEnvio: uuid('clave_envio').notNull(),
  },
  (table) => [
    index('pago_efectivo_pendiente_ix')
      .using('btree', table.fecha.asc().nullsLast().op('date_ops'))
      .where(sql`((medio = 'efectivo'::text) AND (confirmado_en IS NULL))`),
    foreignKey({
      columns: [table.registradoPor],
      foreignColumns: [usuario.id],
      name: 'pago_registrado_por_fkey',
    }),
    foreignKey({
      columns: [table.confirmadoPor],
      foreignColumns: [usuario.id],
      name: 'pago_confirmado_por_fkey',
    }),
    foreignKey({
      columns: [table.fecha, table.cuentaNumero],
      foreignColumns: [cuenta.fecha, cuenta.numero],
      name: 'pago_cuenta_fk',
    }),
    primaryKey({ columns: [table.cuentaNumero, table.fecha, table.numero], name: 'pago_pkey' }),
    unique('pago_clave_envio_uq').on(table.claveEnvio),
    check('pago_monto_check', sql`monto > 0`),
    check('pago_numero_check', sql`(numero >= 1) AND (numero <= 50)`),
    check(
      'pago_medio_check',
      sql`medio = ANY (ARRAY['efectivo'::text, 'tarjeta'::text, 'transferencia'::text])`,
    ),
    check('pago_propina_check', sql`propina >= 0`),
    check('pago_confirmacion_ck', sql`(confirmado_en IS NULL) = (confirmado_por IS NULL)`),
    check('pago_confirma_efectivo_ck', sql`(medio = 'efectivo'::text) OR (confirmado_en IS NULL)`),
  ],
);
