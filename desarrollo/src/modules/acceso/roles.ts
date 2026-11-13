import {
  IconArmchair,
  IconBell,
  IconBook2,
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
  IconGlassFull,
  IconHistory,
  IconKey,
  IconLayoutDashboard,
  IconListCheck,
  IconMap2,
  IconMoon,
  IconQrcode,
  IconReceipt2,
  IconSettings,
  IconShieldCheck,
  IconTrophy,
  IconUserCheck,
  IconUsers,
  IconUsersGroup,
  type Icon,
} from '@tabler/icons-react';
import type { Permiso } from '@/shared/autorizacion';

export type ClaveRol = Permiso;

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
  /** Ya tiene pantalla propia; si no, se muestra en construcción. */
  construida?: boolean;
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
  icono: IconCalendarUser,
  grupo: 'Mi cuenta',
  descripcion: 'Calendario de turnos asignados y declaración de disponibilidad.',
  historias: ['HU-09'],
  construida: true,
};

// Brecha 5: cada persona cambia su propia contraseña; la administración ya no la conoce.
const miClave: Seccion = {
  ruta: 'clave',
  etiqueta: 'Mi contraseña',
  icono: IconKey,
  grupo: 'Mi cuenta',
  descripcion: 'Cambiar la contraseña propia; las demás sesiones abiertas se cierran.',
  construida: true,
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
// turno solo ve su calendario y la administración accede a todo.
export const roles: Rol[] = [
  {
    clave: 'admin',
    nombre: 'Administración',
    descripcion: 'Configura el local, publica las noches y cuadra la caja.',
    icono: IconSettings,
    secciones: [
      { ruta: '', etiqueta: 'Resumen', icono: IconLayoutDashboard, construida: true },
      {
        ruta: 'noche',
        etiqueta: 'Noche en curso',
        icono: IconMoon,
        grupo: 'Noche',
        descripcion: 'Abrir la noche con el fondo de caja y cerrarla después de cuadrar el arqueo.',
        historias: ['HU-11', 'HU-12'],
        construida: true,
      },
      {
        ruta: 'calendario',
        etiqueta: 'Calendario de noches',
        icono: IconCalendarEvent,
        grupo: 'Noche',
        descripcion:
          'Programar cada noche: entrada, premio del sorteo, eventos, listas e invitados.',
        // Las listas y los invitados son de cada noche (decisión del Product Owner, 12 nov).
        historias: ['HU-08', 'HU-34'],
        construida: true,
      },
      {
        ruta: 'asignacion',
        etiqueta: 'Asignar turnos',
        icono: IconUserCheck,
        grupo: 'Noche',
        descripcion: 'Asignar rol y ambiente a cada persona viendo quién declaró disponibilidad.',
        historias: ['HU-10'],
        construida: true,
      },
      {
        ruta: 'efectivo',
        etiqueta: 'Confirmar efectivo',
        icono: IconCash,
        grupo: 'Caja',
        descripcion: 'Confirmar el efectivo que entregan los garzones.',
        historias: ['HU-26'],
        construida: true,
      },
      {
        ruta: 'saldos',
        etiqueta: 'Cuentas con saldo',
        icono: IconReceipt2,
        grupo: 'Caja',
        descripcion: 'Cerrar una cuenta con saldo pendiente, dejando registro de quién lo hizo.',
        historias: ['HU-27'],
        construida: true,
      },
      {
        ruta: 'arqueo',
        etiqueta: 'Arqueo',
        icono: IconCalculator,
        grupo: 'Caja',
        descripcion: 'Efectivo esperado, conteo final y nota obligatoria si hay diferencia.',
        historias: ['HU-28'],
        construida: true,
      },
      {
        ruta: 'ventas',
        etiqueta: 'Ventas y propinas',
        icono: IconChartBar,
        grupo: 'Caja',
        descripcion: 'Lo vendido, lo cobrado por medio de pago y las propinas por ambiente.',
        historias: ['HU-29'],
        construida: true,
      },
      {
        ruta: 'ambientes',
        etiqueta: 'Ambientes y estaciones',
        icono: IconBuildingStore,
        grupo: 'Local',
        descripcion: 'Ambientes con el tamaño de su plano y sus estaciones de barra y cocina.',
        historias: ['HU-04'],
        construida: true,
      },
      {
        ruta: 'mapa',
        etiqueta: 'Mapa de mesas',
        icono: IconMap2,
        grupo: 'Local',
        descripcion: 'Crear, mover, redimensionar, rotar, renumerar y retirar mesas.',
        historias: ['HU-05'],
        construida: true,
      },
      {
        ruta: 'qr',
        etiqueta: 'Códigos QR',
        icono: IconQrcode,
        grupo: 'Local',
        descripcion: 'Generar, regenerar y descargar el código QR de cada mesa.',
        historias: ['HU-07'],
        construida: true,
      },
      {
        ruta: 'catalogo',
        etiqueta: 'Catálogo',
        icono: IconBook2,
        grupo: 'Local',
        descripcion: 'Categorías y productos con la regla que indica a qué estación va cada uno.',
        historias: ['HU-06'],
        construida: true,
      },
      {
        ruta: 'personal',
        etiqueta: 'Personal',
        icono: IconUsers,
        grupo: 'Personas',
        descripcion: 'Crear, editar, restablecer y desactivar las cuentas del personal.',
        historias: ['HU-03'],
        construida: true,
      },
      {
        ruta: 'clientes',
        etiqueta: 'Clientes',
        icono: IconHistory,
        grupo: 'Personas',
        descripcion: 'Historial de visitas y reportes de cada cliente.',
        historias: ['HU-36'],
        construida: true,
      },
      operarComo('garzon', 'Garzón', IconClipboardList),
      operarComo('barra', 'Barra', IconBottle),
      operarComo('cocina', 'Cocina', IconChefHat),
      operarComo('guardia', 'Guardia', IconShieldCheck),
      misTurnos,
      miClave,
    ],
  },
  {
    clave: 'garzon',
    nombre: 'Garzón',
    descripcion: 'Atiende las mesas de su ambiente: cuentas, pedidos, entrega y cobro.',
    icono: IconClipboardList,
    secciones: [
      {
        ruta: '',
        etiqueta: 'Mesas',
        icono: IconArmchair,
        historias: ['HU-13'],
        construida: true,
      },
      {
        ruta: 'cuentas',
        etiqueta: 'Cuentas abiertas',
        icono: IconReceipt2,
        descripcion:
          'Cuentas con o sin mesa: tomar pedidos, ver el detalle, anular ítems y cobrar.',
        historias: ['HU-14', 'HU-15', 'HU-16', 'HU-22', 'HU-23', 'HU-24', 'HU-25'],
        construida: true,
      },
      {
        ruta: 'comandas',
        etiqueta: 'Comandas',
        icono: IconListCheck,
        descripcion: 'Avisos de pedidos listos para retirar y marcar como entregados.',
        historias: ['HU-20', 'HU-21'],
        construida: true,
      },
      {
        ruta: 'efectivo',
        etiqueta: 'Efectivo por entregar',
        icono: IconCash,
        descripcion:
          'El efectivo cobrado, con sus propinas, que falta entregar a la administración.',
        historias: ['HU-24'],
        construida: true,
      },
      {
        ruta: 'llamados',
        etiqueta: 'Llamados',
        icono: IconBell,
        descripcion: 'Llamados de los clientes desde la carta digital de su mesa.',
        historias: ['HU-40'],
        construida: true,
      },
      misTurnos,
      miClave,
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
        icono: IconGlassFull,
        historias: ['HU-17', 'HU-19'],
        construida: true,
      },
      misTurnos,
      miClave,
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
        icono: IconChefHat,
        historias: ['HU-18', 'HU-19'],
        construida: true,
      },
      misTurnos,
      miClave,
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
        construida: true,
      },
      {
        ruta: 'puerta',
        etiqueta: 'Estado de la puerta',
        icono: IconUsersGroup,
        // Sin lo recaudado, que es de la administración (pedido del Product Owner, 12 nov).
        descripcion: 'Quién entró, con hora, ticket, nombre, RUT y forma de entrada.',
        historias: ['HU-32'],
        construida: true,
      },
      {
        ruta: 'clientes',
        etiqueta: 'Clientes',
        icono: IconHistory,
        descripcion: 'Historial de visitas y reportes de cada cliente.',
        historias: ['HU-35', 'HU-36'],
        construida: true,
      },
      {
        ruta: 'sorteo',
        etiqueta: 'Sorteo',
        icono: IconTrophy,
        descripcion: 'Sorteo del premio de cada ambiente entre los tickets de la noche.',
        historias: ['HU-37'],
        construida: true,
      },
      misTurnos,
      miClave,
    ],
  },
  {
    clave: 'personal',
    nombre: 'Sin turno',
    descripcion: 'Quien no tiene turno en la noche abierta solo ve su calendario.',
    icono: IconCalendarUser,
    secciones: [{ ...misTurnos, ruta: '', grupo: undefined }, miClave],
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
