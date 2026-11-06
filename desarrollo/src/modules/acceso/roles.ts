import {
  IconBell,
  IconBottle,
  IconBuildingStore,
  IconCalculator,
  IconCalendarEvent,
  IconCalendarUser,
  IconCash,
  IconChartBar,
  IconChefHat,
  IconClipboardList,
  IconDoorEnter,
  IconHistory,
  IconLayoutDashboard,
  IconListCheck,
  IconMap2,
  IconMapPin,
  IconMoon,
  IconQrcode,
  IconReceipt2,
  IconSettings,
  IconShieldCheck,
  IconStar,
  IconTicket,
  IconToolsKitchen2,
  IconUserCheck,
  IconUsers,
  IconUsersGroup,
  type Icon,
} from '@tabler/icons-react';

export type ClaveRol = 'admin' | 'garzon' | 'barra' | 'cocina' | 'guardia' | 'personal';

export interface Seccion {
  /** Vacío en la pantalla de inicio del rol. */
  ruta: string;
  etiqueta: string;
  icono: Icon;
  /** Título bajo el que se agrupa en el menú. */
  grupo?: string;
  descripcion?: string;
  /** Historias del backlog que construyen esta pantalla. */
  historias?: string[];
  /** Lleva a la pantalla de otro rol en vez de a una sección propia. */
  destino?: string;
}

export interface Rol {
  clave: ClaveRol;
  nombre: string;
  descripcion: string;
  icono: Icon;
  secciones: Seccion[];
}

const misTurnos: Seccion = {
  ruta: 'turnos',
  etiqueta: 'Mis turnos',
  icono: IconCalendarEvent,
  grupo: 'Mi cuenta',
  descripcion: 'Calendario de turnos asignados y declaración de disponibilidad.',
  historias: ['HU-09'],
};

const operarComo = (clave: ClaveRol, etiqueta: string, icono: Icon): Seccion => ({
  ruta: clave,
  etiqueta,
  icono,
  grupo: 'Operación',
  destino: `/${clave}`,
});

// La sesión y la carta pública no pasan por este menú.
export const historiasFueraDelMenu = ['HU-01', 'HU-02', 'HU-38', 'HU-39'];

// Pantallas de cada rol, según RF-04: el rol sale del turno de la noche abierta, quien no tiene
// turno solo ve su calendario y la administración accede a todo. Mientras no exista el inicio de
// sesión (HU-01), el rol se elige en la portada y no restringe el acceso.
export const roles: Rol[] = [
  {
    clave: 'admin',
    nombre: 'Administración',
    descripcion: 'Configura el local, publica las noches y cuadra la caja.',
    icono: IconSettings,
    secciones: [
      { ruta: '', etiqueta: 'Resumen', icono: IconLayoutDashboard },
      {
        ruta: 'noche',
        etiqueta: 'Noche en curso',
        icono: IconMoon,
        grupo: 'Noche',
        descripcion: 'Abrir la noche con el fondo de caja y cerrarla después de cuadrar el arqueo.',
        historias: ['HU-11', 'HU-12'],
      },
      {
        ruta: 'calendario',
        etiqueta: 'Calendario de noches',
        icono: IconCalendarEvent,
        grupo: 'Noche',
        descripcion: 'Programar las noches de apertura con una nota y el precio de entrada.',
        historias: ['HU-08'],
      },
      {
        ruta: 'asignacion',
        etiqueta: 'Asignar turnos',
        icono: IconUserCheck,
        grupo: 'Noche',
        descripcion: 'Asignar rol y ambiente a cada persona viendo quién declaró disponibilidad.',
        historias: ['HU-10'],
      },
      {
        ruta: 'efectivo',
        etiqueta: 'Confirmar efectivo',
        icono: IconCash,
        grupo: 'Caja',
        descripcion: 'Confirmar el efectivo que entregan los garzones.',
        historias: ['HU-26'],
      },
      {
        ruta: 'saldos',
        etiqueta: 'Cuentas con saldo',
        icono: IconReceipt2,
        grupo: 'Caja',
        descripcion: 'Cerrar una cuenta con saldo pendiente, dejando registro de quién lo hizo.',
        historias: ['HU-27'],
      },
      {
        ruta: 'arqueo',
        etiqueta: 'Arqueo',
        icono: IconCalculator,
        grupo: 'Caja',
        descripcion: 'Efectivo esperado, conteo final y nota obligatoria si hay diferencia.',
        historias: ['HU-28'],
      },
      {
        ruta: 'ventas',
        etiqueta: 'Ventas y propinas',
        icono: IconChartBar,
        grupo: 'Caja',
        descripcion: 'Lo vendido, lo cobrado por medio de pago y las propinas por ambiente.',
        historias: ['HU-29'],
      },
      {
        ruta: 'ambientes',
        etiqueta: 'Ambientes y estaciones',
        icono: IconBuildingStore,
        grupo: 'Local',
        descripcion: 'Ambientes con el tamaño de su plano y sus estaciones de barra y cocina.',
        historias: ['HU-04'],
      },
      {
        ruta: 'mapa',
        etiqueta: 'Mapa de mesas',
        icono: IconMap2,
        grupo: 'Local',
        descripcion: 'Crear, mover, redimensionar, rotar, renumerar y retirar mesas.',
        historias: ['HU-05'],
      },
      {
        ruta: 'qr',
        etiqueta: 'Códigos QR',
        icono: IconQrcode,
        grupo: 'Local',
        descripcion: 'Generar, regenerar y descargar el código QR de cada mesa.',
        historias: ['HU-07'],
      },
      {
        ruta: 'catalogo',
        etiqueta: 'Catálogo',
        icono: IconClipboardList,
        grupo: 'Local',
        descripcion: 'Categorías y productos con la regla que indica a qué estación va cada uno.',
        historias: ['HU-06'],
      },
      {
        ruta: 'personal',
        etiqueta: 'Personal',
        icono: IconUsers,
        grupo: 'Personas',
        descripcion: 'Crear, editar, restablecer y desactivar las cuentas del personal.',
        historias: ['HU-03'],
      },
      {
        ruta: 'invitados',
        etiqueta: 'Invitados',
        icono: IconStar,
        grupo: 'Personas',
        descripcion: 'Lista de invitados que portería reconoce al registrar el ingreso.',
        historias: ['HU-34'],
      },
      {
        ruta: 'clientes',
        etiqueta: 'Clientes',
        icono: IconHistory,
        grupo: 'Personas',
        descripcion: 'Historial de visitas y reportes de cada cliente.',
        historias: ['HU-36'],
      },
      operarComo('garzon', 'Garzón', IconClipboardList),
      operarComo('barra', 'Barra', IconBottle),
      operarComo('cocina', 'Cocina', IconChefHat),
      operarComo('guardia', 'Guardia', IconShieldCheck),
      misTurnos,
    ],
  },
  {
    clave: 'garzon',
    nombre: 'Garzón',
    descripcion: 'Atiende las mesas de su ambiente: cuentas, pedidos, entrega y cobro.',
    icono: IconClipboardList,
    secciones: [
      { ruta: '', etiqueta: 'Mesas', icono: IconMapPin, historias: ['HU-13'] },
      {
        ruta: 'cuentas',
        etiqueta: 'Cuentas abiertas',
        icono: IconReceipt2,
        descripcion:
          'Cuentas con o sin mesa: tomar pedidos, ver el detalle, anular ítems y cobrar.',
        historias: ['HU-14', 'HU-15', 'HU-16', 'HU-22', 'HU-23', 'HU-24', 'HU-25'],
      },
      {
        ruta: 'comandas',
        etiqueta: 'Comandas listas',
        icono: IconListCheck,
        descripcion: 'Avisos de pedidos listos para retirar y marcar como entregados.',
        historias: ['HU-20', 'HU-21'],
      },
      {
        ruta: 'llamados',
        etiqueta: 'Llamados',
        icono: IconBell,
        descripcion: 'Llamados de los clientes desde la carta digital de su mesa.',
        historias: ['HU-40'],
      },
      misTurnos,
    ],
  },
  {
    clave: 'barra',
    nombre: 'Barra',
    descripcion: 'Prepara los pedidos que llegan a la barra de su ambiente.',
    icono: IconBottle,
    secciones: [
      {
        ruta: '',
        etiqueta: 'Cola de comandas',
        icono: IconListCheck,
        historias: ['HU-17', 'HU-19'],
      },
      misTurnos,
    ],
  },
  {
    clave: 'cocina',
    nombre: 'Cocina',
    descripcion: 'Prepara la comida, con el número de personas y las notas de cada ítem.',
    icono: IconChefHat,
    secciones: [
      {
        ruta: '',
        etiqueta: 'Cola de comandas',
        icono: IconToolsKitchen2,
        historias: ['HU-18', 'HU-19'],
      },
      misTurnos,
    ],
  },
  {
    clave: 'guardia',
    nombre: 'Guardia',
    descripcion: 'Controla el ingreso, los reportes de clientes y el sorteo de la noche.',
    icono: IconShieldCheck,
    secciones: [
      {
        ruta: '',
        etiqueta: 'Entrada',
        icono: IconDoorEnter,
        historias: ['HU-30', 'HU-31', 'HU-33'],
      },
      {
        ruta: 'puerta',
        etiqueta: 'Estado de la puerta',
        icono: IconUsersGroup,
        descripcion: 'Personas registradas, lo recaudado por medio de pago y el último ticket.',
        historias: ['HU-32'],
      },
      {
        ruta: 'clientes',
        etiqueta: 'Clientes',
        icono: IconHistory,
        descripcion: 'Historial de visitas y reportes de cada cliente.',
        historias: ['HU-35', 'HU-36'],
      },
      {
        ruta: 'sorteo',
        etiqueta: 'Sorteo',
        icono: IconTicket,
        descripcion: 'Sorteo del premio de cada ambiente entre los tickets pagados de la noche.',
        historias: ['HU-37'],
      },
      misTurnos,
    ],
  },
  {
    clave: 'personal',
    nombre: 'Sin turno',
    descripcion: 'Quien no tiene turno en la noche abierta solo ve su calendario.',
    icono: IconCalendarUser,
    secciones: [{ ...misTurnos, ruta: '', grupo: undefined }],
  },
];

export const rolDeRuta = (ruta: string): Rol | undefined =>
  roles.find((r) => r.clave === ruta.split('/')[1]);

export const rutaDe = (rol: Rol, seccion: Seccion): string =>
  seccion.destino ?? (seccion.ruta ? `/${rol.clave}/${seccion.ruta}` : `/${rol.clave}`);

export function gruposDe(rol: Rol): { titulo?: string; secciones: Seccion[] }[] {
  const grupos: { titulo?: string; secciones: Seccion[] }[] = [];
  for (const seccion of rol.secciones) {
    const ultimo = grupos.at(-1);
    if (ultimo && ultimo.titulo === seccion.grupo) ultimo.secciones.push(seccion);
    else grupos.push({ titulo: seccion.grupo, secciones: [seccion] });
  }
  return grupos;
}
