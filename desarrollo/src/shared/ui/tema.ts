import { createTheme, type MantineColorsTuple } from '@mantine/core';

// Violeta de GesNoc: el acento de la imagen de referencia (sección activa, botón principal, totales).
const violeta: MantineColorsTuple = [
  '#f1edff',
  '#e1d9ff',
  '#c0b0ff',
  '#9d84ff',
  '#8462ff',
  '#7450fb',
  '#6a42f2',
  '#5a35d6',
  '#4d2dbd',
  '#4024a3',
];

// Fondo nocturno azulado. En el esquema oscuro Mantine usa dark[7] para el fondo, dark[6] para las
// superficies, dark[5] al pasar el dedo, dark[4] para los bordes y dark[2] para el texto atenuado.
const noche: MantineColorsTuple = [
  '#e8e8f2',
  '#bdbdd0',
  '#9090a8',
  '#68688a',
  '#34344d',
  '#29293f',
  '#202033',
  '#171726',
  '#11111c',
  '#0b0b13',
];

// Objeto simple y no Button.extend(): el tema se arma en el layout, que es un componente de
// servidor, y allí los componentes de Mantine son solo referencias.
export const tema = createTheme({
  primaryColor: 'violeta',
  primaryShade: { light: 6, dark: 5 },
  colors: { violeta, dark: noche },
  fontFamily: 'var(--fuente-gesnoc), system-ui, sans-serif',
  fontFamilyMonospace: 'ui-monospace, monospace',
  headings: { fontFamily: 'var(--fuente-gesnoc), system-ui, sans-serif', fontWeight: '700' },
  defaultRadius: 'md',
  radius: { sm: '8px', md: '10px', lg: '14px', xl: '20px' },
  components: {
    // Botones de al menos 44 px de alto para usarlos con una mano y con poca luz (RNF-09).
    Button: { defaultProps: { size: 'lg' } },
    Card: { defaultProps: { radius: 'lg' } },
    Paper: { defaultProps: { radius: 'lg' } },
    Modal: { defaultProps: { radius: 'lg' } },
    SegmentedControl: { defaultProps: { radius: 'md' } },
  },
});

/** Colores del plano y de los estados, compartidos por el mapa del garzón y el editor. */
export const colorDeEstado = {
  libre: '#34344d',
  ocupada: '#7450fb',
  lista: '#2fbf71',
  espera: '#f59f0b',
} as const;
