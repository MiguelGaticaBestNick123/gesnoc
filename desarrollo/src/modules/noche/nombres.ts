export const nombreDelRol: Record<string, string> = {
  garzon: 'Garzón',
  barman: 'Barra',
  cocinero: 'Cocina',
  guardia: 'Guardia',
};

/** Cómo se muestra el estado de una noche en el calendario y en su página. */
export const estadosDeNoche = {
  programada: { texto: 'Programada', color: 'violeta' },
  abierta: { texto: 'Abierta', color: 'green' },
  cerrada: { texto: 'Cerrada', color: 'gray' },
} as const;

/** Color de cada rol en los calendarios y la asignación. */
export const colorDelRol: Record<string, string> = {
  garzon: 'violeta',
  barman: 'blue',
  cocinero: 'orange',
  guardia: 'yellow',
};
