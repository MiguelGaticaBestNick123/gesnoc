import { relations } from 'drizzle-orm/relations';
import {
  usuario,
  sesion,
  ambiente,
  mesa,
  estacion,
  categoria,
  producto,
  noche,
  arqueo,
  disponibilidad,
  asignacion,
  comanda,
  pedido,
  sorteo,
  entrada,
  llamado,
  cuenta,
  cliente,
  reporte,
  invitado,
  detallePedido,
  pago,
} from './schema';

export const sesionRelations = relations(sesion, ({ one }) => ({
  usuario: one(usuario, {
    fields: [sesion.usuarioId],
    references: [usuario.id],
  }),
}));

export const usuarioRelations = relations(usuario, ({ many }) => ({
  sesions: many(sesion),
  arqueos: many(arqueo),
  disponibilidads: many(disponibilidad),
  asignacions: many(asignacion),
  sorteos: many(sorteo),
  llamados: many(llamado),
  pedidos: many(pedido),
  reportes: many(reporte),
  entradas: many(entrada),
  cuentas_abiertaPor: many(cuenta, {
    relationName: 'cuenta_abiertaPor_usuario_id',
  }),
  cuentas_cerradaPor: many(cuenta, {
    relationName: 'cuenta_cerradaPor_usuario_id',
  }),
  detallePedidos: many(detallePedido),
  pagos_registradoPor: many(pago, {
    relationName: 'pago_registradoPor_usuario_id',
  }),
  pagos_confirmadoPor: many(pago, {
    relationName: 'pago_confirmadoPor_usuario_id',
  }),
}));

export const mesaRelations = relations(mesa, ({ one, many }) => ({
  ambiente: one(ambiente, {
    fields: [mesa.ambienteId],
    references: [ambiente.id],
  }),
  llamados: many(llamado),
  cuentas: many(cuenta),
}));

export const ambienteRelations = relations(ambiente, ({ many }) => ({
  mesas: many(mesa),
  estacions: many(estacion),
  asignacions: many(asignacion),
  sorteos: many(sorteo),
  cuentas: many(cuenta),
}));

export const estacionRelations = relations(estacion, ({ one, many }) => ({
  ambiente: one(ambiente, {
    fields: [estacion.ambienteId],
    references: [ambiente.id],
  }),
  categorias: many(categoria),
  productos: many(producto),
  comandas: many(comanda),
}));

export const categoriaRelations = relations(categoria, ({ one, many }) => ({
  estacion: one(estacion, {
    fields: [categoria.estacionId],
    references: [estacion.id],
  }),
  productos: many(producto),
}));

export const productoRelations = relations(producto, ({ one, many }) => ({
  categoria: one(categoria, {
    fields: [producto.categoriaId],
    references: [categoria.id],
  }),
  estacion: one(estacion, {
    fields: [producto.estacionId],
    references: [estacion.id],
  }),
  detallePedidos: many(detallePedido),
}));

export const arqueoRelations = relations(arqueo, ({ one }) => ({
  noche: one(noche, {
    fields: [arqueo.fecha],
    references: [noche.fecha],
  }),
  usuario: one(usuario, {
    fields: [arqueo.contadoPor],
    references: [usuario.id],
  }),
}));

export const nocheRelations = relations(noche, ({ many }) => ({
  arqueos: many(arqueo),
  disponibilidads: many(disponibilidad),
  asignacions: many(asignacion),
  sorteos: many(sorteo),
  llamados: many(llamado),
  pedidos: many(pedido),
  reportes: many(reporte),
  entradas: many(entrada),
  cuentas: many(cuenta),
}));

export const disponibilidadRelations = relations(disponibilidad, ({ one }) => ({
  noche: one(noche, {
    fields: [disponibilidad.fecha],
    references: [noche.fecha],
  }),
  usuario: one(usuario, {
    fields: [disponibilidad.usuarioId],
    references: [usuario.id],
  }),
}));

export const asignacionRelations = relations(asignacion, ({ one }) => ({
  noche: one(noche, {
    fields: [asignacion.fecha],
    references: [noche.fecha],
  }),
  usuario: one(usuario, {
    fields: [asignacion.usuarioId],
    references: [usuario.id],
  }),
  ambiente: one(ambiente, {
    fields: [asignacion.ambienteId],
    references: [ambiente.id],
  }),
}));

export const comandaRelations = relations(comanda, ({ one, many }) => ({
  estacion: one(estacion, {
    fields: [comanda.estacionId],
    references: [estacion.id],
  }),
  pedido: one(pedido, {
    fields: [comanda.fecha],
    references: [pedido.fecha],
  }),
  detallePedidos: many(detallePedido),
}));

export const pedidoRelations = relations(pedido, ({ one, many }) => ({
  comandas: many(comanda),
  noche: one(noche, {
    fields: [pedido.fecha],
    references: [noche.fecha],
  }),
  usuario: one(usuario, {
    fields: [pedido.tomadoPor],
    references: [usuario.id],
  }),
  cuenta: one(cuenta, {
    fields: [pedido.fecha],
    references: [cuenta.fecha],
  }),
  detallePedidos: many(detallePedido),
}));

export const sorteoRelations = relations(sorteo, ({ one }) => ({
  noche: one(noche, {
    fields: [sorteo.fecha],
    references: [noche.fecha],
  }),
  ambiente: one(ambiente, {
    fields: [sorteo.ambienteId],
    references: [ambiente.id],
  }),
  usuario: one(usuario, {
    fields: [sorteo.realizadoPor],
    references: [usuario.id],
  }),
  entrada: one(entrada, {
    fields: [sorteo.fecha],
    references: [entrada.fecha],
  }),
}));

export const entradaRelations = relations(entrada, ({ one, many }) => ({
  sorteos: many(sorteo),
  noche: one(noche, {
    fields: [entrada.fecha],
    references: [noche.fecha],
  }),
  cliente: one(cliente, {
    fields: [entrada.clienteId],
    references: [cliente.id],
  }),
  usuario: one(usuario, {
    fields: [entrada.registradaPor],
    references: [usuario.id],
  }),
  invitado: one(invitado, {
    fields: [entrada.invitadoId],
    references: [invitado.id],
  }),
}));

export const llamadoRelations = relations(llamado, ({ one }) => ({
  noche: one(noche, {
    fields: [llamado.fecha],
    references: [noche.fecha],
  }),
  mesa: one(mesa, {
    fields: [llamado.mesaId],
    references: [mesa.id],
  }),
  usuario: one(usuario, {
    fields: [llamado.atendidoPor],
    references: [usuario.id],
  }),
}));

export const cuentaRelations = relations(cuenta, ({ one, many }) => ({
  pedidos: many(pedido),
  noche: one(noche, {
    fields: [cuenta.fecha],
    references: [noche.fecha],
  }),
  mesa: one(mesa, {
    fields: [cuenta.mesaId],
    references: [mesa.id],
  }),
  ambiente: one(ambiente, {
    fields: [cuenta.ambienteId],
    references: [ambiente.id],
  }),
  usuario_abiertaPor: one(usuario, {
    fields: [cuenta.abiertaPor],
    references: [usuario.id],
    relationName: 'cuenta_abiertaPor_usuario_id',
  }),
  usuario_cerradaPor: one(usuario, {
    fields: [cuenta.cerradaPor],
    references: [usuario.id],
    relationName: 'cuenta_cerradaPor_usuario_id',
  }),
  pagos: many(pago),
}));

export const reporteRelations = relations(reporte, ({ one }) => ({
  cliente: one(cliente, {
    fields: [reporte.clienteId],
    references: [cliente.id],
  }),
  noche: one(noche, {
    fields: [reporte.fecha],
    references: [noche.fecha],
  }),
  usuario: one(usuario, {
    fields: [reporte.registradoPor],
    references: [usuario.id],
  }),
}));

export const clienteRelations = relations(cliente, ({ many }) => ({
  reportes: many(reporte),
  entradas: many(entrada),
}));

export const invitadoRelations = relations(invitado, ({ many }) => ({
  entradas: many(entrada),
}));

export const detallePedidoRelations = relations(detallePedido, ({ one }) => ({
  producto: one(producto, {
    fields: [detallePedido.productoId],
    references: [producto.id],
  }),
  usuario: one(usuario, {
    fields: [detallePedido.anuladoPor],
    references: [usuario.id],
  }),
  pedido: one(pedido, {
    fields: [detallePedido.fecha],
    references: [pedido.fecha],
  }),
  comanda: one(comanda, {
    fields: [detallePedido.fecha],
    references: [comanda.estacionId],
  }),
}));

export const pagoRelations = relations(pago, ({ one }) => ({
  usuario_registradoPor: one(usuario, {
    fields: [pago.registradoPor],
    references: [usuario.id],
    relationName: 'pago_registradoPor_usuario_id',
  }),
  usuario_confirmadoPor: one(usuario, {
    fields: [pago.confirmadoPor],
    references: [usuario.id],
    relationName: 'pago_confirmadoPor_usuario_id',
  }),
  cuenta: one(cuenta, {
    fields: [pago.fecha],
    references: [cuenta.fecha],
  }),
}));
