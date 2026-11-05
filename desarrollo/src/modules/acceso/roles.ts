import {
  IconBottle,
  IconCalendarEvent,
  IconCash,
  IconChefHat,
  IconClipboardList,
  IconDoorEnter,
  IconLayoutDashboard,
  IconListCheck,
  IconMapPin,
  IconShieldCheck,
  IconStar,
  IconTicket,
  IconToolsKitchen2,
  IconUsers,
  IconBell,
  IconHistory,
  IconSettings,
  type Icon,
} from '@tabler/icons-react';

export type ClaveRol = 'admin' | 'garzon' | 'barra' | 'cocina' | 'guardia';

export interface Seccion {
  /** Vacío en la pantalla de inicio del rol. */
  ruta: string;
  etiqueta: string;
  icono: Icon;
  descripcion?: string;
  historias?: string[];
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
  descripcion: 'Calendario de turnos asignados y declaración de disponibilidad.',
  historias: ['HU-09'],
};

// Pantallas de cada rol. Las que tienen `historias` todavía son un esqueleto. Mientras no
// exista el inicio de sesión (HU-01), el rol se elige en la portada y no restringe el acceso.
export const roles: Rol[] = [
  {
    clave: 'admin',
    nombre: 'Administración',
    descripcion: 'Configura el local, publica las noches y cuadra la caja.',
    icono: IconSettings,
    secciones: [
      { ruta: '', etiqueta: 'Resumen', icono: IconLayoutDashboard },
      {
        ruta: 'noches',
        etiqueta: 'Noches y turnos',
        icono: IconCalendarEvent,
        descripcion: 'Programar noches, asignar rol y ambiente, abrir y cerrar la noche.',
        historias: ['HU-08', 'HU-10', 'HU-11', 'HU-12'],
      },
      {
        ruta: 'personal',
        etiqueta: 'Personal',
        icono: IconUsers,
        descripcion: 'Crear, editar, restablecer y desactivar las cuentas del personal.',
        historias: ['HU-03'],
      },
      {
        ruta: 'local',
        etiqueta: 'Local y mesas',
        icono: IconMapPin,
        descripcion: 'Ambientes, estaciones, mapa de mesas y códigos QR.',
        historias: ['HU-04', 'HU-05', 'HU-07'],
      },
      {
        ruta: 'catalogo',
        etiqueta: 'Catálogo',
        icono: IconClipboardList,
        descripcion: 'Categorías y productos con la regla que indica a qué estación va cada uno.',
        historias: ['HU-06'],
      },
      {
        ruta: 'caja',
        etiqueta: 'Caja',
        icono: IconCash,
        descripcion: 'Confirmar efectivo, cerrar cuentas con saldo, arqueo y resumen de la noche.',
        historias: ['HU-26', 'HU-27', 'HU-28', 'HU-29'],
      },
      {
        ruta: 'invitados',
        etiqueta: 'Invitados',
        icono: IconStar,
        descripcion: 'Lista de invitados que portería reconoce al registrar el ingreso.',
        historias: ['HU-34'],
      },
    ],
  },
  {
    clave: 'garzon',
    nombre: 'Garzón',
    descripcion: 'Atiende las mesas de su ambiente: cuentas, pedidos, entrega y cobro.',
    icono: IconClipboardList,
    secciones: [
      { ruta: '', etiqueta: 'Mesas', icono: IconMapPin },
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
    secciones: [{ ruta: '', etiqueta: 'Cola de comandas', icono: IconListCheck }, misTurnos],
  },
  {
    clave: 'cocina',
    nombre: 'Cocina',
    descripcion: 'Prepara la comida, con el número de personas y las notas de cada ítem.',
    icono: IconChefHat,
    secciones: [{ ruta: '', etiqueta: 'Cola de comandas', icono: IconToolsKitchen2 }, misTurnos],
  },
  {
    clave: 'guardia',
    nombre: 'Guardia',
    descripcion: 'Controla el ingreso, los reportes de clientes y el sorteo de la noche.',
    icono: IconShieldCheck,
    secciones: [
      { ruta: '', etiqueta: 'Entrada', icono: IconDoorEnter },
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
];

export const rolDeRuta = (ruta: string): Rol | undefined =>
  roles.find((r) => r.clave === ruta.split('/')[1]);

export const rutaDe = (rol: Rol, seccion: Seccion): string =>
  seccion.ruta ? `/${rol.clave}/${seccion.ruta}` : `/${rol.clave}`;
