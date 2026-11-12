import { relations } from 'drizzle-orm/relations';
import {
  usuario,
  sesion,
  ambiente,
  mesa,
  estacion,
  categoria,
  producto,
  arqueo,
  noche,
  disponibilidad,
  asignacion,
  evento,
  premio,
  comanda,
  pedido,
  lista,
  sorteo,
  entrada,
  llamado,
  cuenta,
  cliente,
  reporte,
  invitacion,
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
  pagos_confirmadoPor: many(pago, {
    relationName: 'pago_confirmadoPor_usuario_id',
  }),
  pagos_registradoPor: many(pago, {
    relationName: 'pago_registradoPor_usuario_id',
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
  premios: many(premio),
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
  premios: many(premio),
  detallePedidos: many(detallePedido),
}));

export const arqueoRelations = relations(arqueo, ({ one }) => ({
  usuario: one(usuario, {
    fields: [arqueo.contadoPor],
    references: [usuario.id],
  }),
  noche: one(noche, {
    fields: [arqueo.fecha],
    references: [noche.fecha],
  }),
}));

export const nocheRelations = relations(noche, ({ many }) => ({
  arqueos: many(arqueo),
  disponibilidads: many(disponibilidad),
  asignacions: many(asignacion),
  eventos: many(evento),
  premios: many(premio),
  listas: many(lista),
  sorteos: many(sorteo),
  llamados: many(llamado),
  pedidos: many(pedido),
  reportes: many(reporte),
  invitacions: many(invitacion),
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
  ambiente: one(ambiente, {
    fields: [asignacion.ambienteId],
    references: [ambiente.id],
  }),
  noche: one(noche, {
    fields: [asignacion.fecha],
    references: [noche.fecha],
  }),
  usuario: one(usuario, {
    fields: [asignacion.usuarioId],
    references: [usuario.id],
  }),
}));

export const eventoRelations = relations(evento, ({ one }) => ({
  noche: one(noche, {
    fields: [evento.fecha],
    references: [noche.fecha],
  }),
}));

export const premioRelations = relations(premio, ({ one }) => ({
  ambiente: one(ambiente, {
    fields: [premio.ambienteId],
    references: [ambiente.id],
  }),
  noche: one(noche, {
    fields: [premio.fecha],
    references: [noche.fecha],
  }),
  producto: one(producto, {
    fields: [premio.productoId],
    references: [producto.id],
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
  cuenta: one(cuenta, {
    fields: [pedido.fecha],
    references: [cuenta.fecha],
  }),
  noche: one(noche, {
    fields: [pedido.fecha],
    references: [noche.fecha],
  }),
  usuario: one(usuario, {
    fields: [pedido.tomadoPor],
    references: [usuario.id],
  }),
  detallePedidos: many(detallePedido),
}));

export const listaRelations = relations(lista, ({ one, many }) => ({
  noche: one(noche, {
    fields: [lista.fecha],
    references: [noche.fecha],
  }),
  invitacions: many(invitacion),
}));

export const sorteoRelations = relations(sorteo, ({ one }) => ({
  ambiente: one(ambiente, {
    fields: [sorteo.ambienteId],
    references: [ambiente.id],
  }),
  noche: one(noche, {
    fields: [sorteo.fecha],
    references: [noche.fecha],
  }),
  entrada: one(entrada, {
    fields: [sorteo.fecha],
    references: [entrada.fecha],
  }),
  usuario: one(usuario, {
    fields: [sorteo.realizadoPor],
    references: [usuario.id],
  }),
}));

export const entradaRelations = relations(entrada, ({ one, many }) => ({
  sorteos: many(sorteo),
  cliente: one(cliente, {
    fields: [entrada.clienteId],
    references: [cliente.id],
  }),
  noche: one(noche, {
    fields: [entrada.fecha],
    references: [noche.fecha],
  }),
  usuario: one(usuario, {
    fields: [entrada.registradaPor],
    references: [usuario.id],
  }),
}));

export const llamadoRelations = relations(llamado, ({ one }) => ({
  usuario: one(usuario, {
    fields: [llamado.atendidoPor],
    references: [usuario.id],
  }),
  noche: one(noche, {
    fields: [llamado.fecha],
    references: [noche.fecha],
  }),
  mesa: one(mesa, {
    fields: [llamado.mesaId],
    references: [mesa.id],
  }),
}));

export const cuentaRelations = relations(cuenta, ({ one, many }) => ({
  pedidos: many(pedido),
  usuario_abiertaPor: one(usuario, {
    fields: [cuenta.abiertaPor],
    references: [usuario.id],
    relationName: 'cuenta_abiertaPor_usuario_id',
  }),
  ambiente: one(ambiente, {
    fields: [cuenta.ambienteId],
    references: [ambiente.id],
  }),
  usuario_cerradaPor: one(usuario, {
    fields: [cuenta.cerradaPor],
    references: [usuario.id],
    relationName: 'cuenta_cerradaPor_usuario_id',
  }),
  noche: one(noche, {
    fields: [cuenta.fecha],
    references: [noche.fecha],
  }),
  mesa: one(mesa, {
    fields: [cuenta.mesaId],
    references: [mesa.id],
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

export const invitacionRelations = relations(invitacion, ({ one }) => ({
  noche: one(noche, {
    fields: [invitacion.fecha],
    references: [noche.fecha],
  }),
  lista: one(lista, {
    fields: [invitacion.fecha],
    references: [lista.fecha],
  }),
}));

export const detallePedidoRelations = relations(detallePedido, ({ one }) => ({
  comanda: one(comanda, {
    fields: [detallePedido.fecha],
    references: [comanda.fecha],
  }),
  usuario: one(usuario, {
    fields: [detallePedido.anuladoPor],
    references: [usuario.id],
  }),
  pedido: one(pedido, {
    fields: [detallePedido.fecha],
    references: [pedido.fecha],
  }),
  producto: one(producto, {
    fields: [detallePedido.productoId],
    references: [producto.id],
  }),
}));

export const pagoRelations = relations(pago, ({ one }) => ({
  usuario_confirmadoPor: one(usuario, {
    fields: [pago.confirmadoPor],
    references: [usuario.id],
    relationName: 'pago_confirmadoPor_usuario_id',
  }),
  cuenta: one(cuenta, {
    fields: [pago.fecha],
    references: [cuenta.fecha],
  }),
  usuario_registradoPor: one(usuario, {
    fields: [pago.registradoPor],
    references: [usuario.id],
    relationName: 'pago_registradoPor_usuario_id',
  }),
}));
