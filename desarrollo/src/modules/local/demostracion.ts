// Local de demostración: dos ambientes con sus mesas y estaciones, con los mismos
// campos del modelo (mesa: numero, forma, pos_x, pos_y, ancho, alto, rotacion).
// Sirve para construir las pantallas antes de conectarlas a la base.

export type FormaMesa = 'rectangular' | 'redonda';

export interface Mesa {
  id: number;
  numero: number;
  forma: FormaMesa;
  posX: number;
  posY: number;
  ancho: number;
  alto: number;
  rotacion: number;
}

export interface Estacion {
  id: number;
  nombre: string;
  tipo: 'barra' | 'cocina';
}

export interface Ambiente {
  id: number;
  nombre: string;
  planoAncho: number;
  planoAlto: number;
  mesas: Mesa[];
  estaciones: Estacion[];
}

export const ambientes: Ambiente[] = [
  {
    id: 1,
    nombre: 'Salón',
    planoAncho: 900,
    planoAlto: 440,
    estaciones: [
      { id: 1, nombre: 'Barra Salón', tipo: 'barra' },
      { id: 2, nombre: 'Cocina', tipo: 'cocina' },
    ],
    mesas: [
      {
        id: 1,
        numero: 1,
        forma: 'rectangular',
        posX: 40,
        posY: 40,
        ancho: 110,
        alto: 80,
        rotacion: 0,
      },
      {
        id: 2,
        numero: 2,
        forma: 'rectangular',
        posX: 200,
        posY: 40,
        ancho: 110,
        alto: 80,
        rotacion: 0,
      },
      {
        id: 3,
        numero: 3,
        forma: 'rectangular',
        posX: 360,
        posY: 40,
        ancho: 110,
        alto: 80,
        rotacion: 0,
      },
      {
        id: 4,
        numero: 4,
        forma: 'rectangular',
        posX: 520,
        posY: 40,
        ancho: 110,
        alto: 80,
        rotacion: 0,
      },
      {
        id: 5,
        numero: 5,
        forma: 'rectangular',
        posX: 680,
        posY: 40,
        ancho: 110,
        alto: 80,
        rotacion: 0,
      },
      {
        id: 6,
        numero: 6,
        forma: 'rectangular',
        posX: 40,
        posY: 180,
        ancho: 180,
        alto: 90,
        rotacion: 0,
      },
      {
        id: 7,
        numero: 7,
        forma: 'redonda',
        posX: 300,
        posY: 170,
        ancho: 110,
        alto: 110,
        rotacion: 0,
      },
      {
        id: 8,
        numero: 8,
        forma: 'rectangular',
        posX: 480,
        posY: 180,
        ancho: 150,
        alto: 90,
        rotacion: 0,
      },
      {
        id: 9,
        numero: 9,
        forma: 'rectangular',
        posX: 700,
        posY: 180,
        ancho: 110,
        alto: 80,
        rotacion: 0,
      },
      {
        id: 10,
        numero: 10,
        forma: 'rectangular',
        posX: 40,
        posY: 320,
        ancho: 110,
        alto: 80,
        rotacion: 0,
      },
      {
        id: 11,
        numero: 11,
        forma: 'rectangular',
        posX: 260,
        posY: 320,
        ancho: 180,
        alto: 80,
        rotacion: 0,
      },
      {
        id: 12,
        numero: 12,
        forma: 'rectangular',
        posX: 620,
        posY: 320,
        ancho: 110,
        alto: 80,
        rotacion: 0,
      },
    ],
  },
  {
    id: 2,
    nombre: 'Terraza',
    planoAncho: 900,
    planoAlto: 300,
    estaciones: [{ id: 3, nombre: 'Barra Terraza', tipo: 'barra' }],
    mesas: [
      {
        id: 13,
        numero: 1,
        forma: 'redonda',
        posX: 60,
        posY: 50,
        ancho: 100,
        alto: 100,
        rotacion: 0,
      },
      {
        id: 14,
        numero: 2,
        forma: 'redonda',
        posX: 260,
        posY: 50,
        ancho: 100,
        alto: 100,
        rotacion: 0,
      },
      {
        id: 15,
        numero: 3,
        forma: 'redonda',
        posX: 460,
        posY: 50,
        ancho: 100,
        alto: 100,
        rotacion: 0,
      },
      {
        id: 16,
        numero: 4,
        forma: 'rectangular',
        posX: 660,
        posY: 60,
        ancho: 170,
        alto: 80,
        rotacion: 0,
      },
      {
        id: 17,
        numero: 5,
        forma: 'rectangular',
        posX: 160,
        posY: 190,
        ancho: 170,
        alto: 80,
        rotacion: 0,
      },
      {
        id: 18,
        numero: 6,
        forma: 'rectangular',
        posX: 500,
        posY: 190,
        ancho: 170,
        alto: 80,
        rotacion: 0,
      },
    ],
  },
];
