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
  // Sobre un relleno claro (el verde de «Recibí», el gris de «Desactivada») el texto va oscuro, y
  // sobre uno oscuro, blanco: así todo botón e insignia rellenos cumplen el contraste de WCAG AA.
  // Mantine decide mirando el tono del tema claro (6), un punto más oscuro que el que se ve de noche
  // (5): con el umbral en 0,2, el violeta sigue en blanco (4,9:1) y el gris, el azul y el rojo
  // pasan a texto oscuro (sobre 5,9:1).
  autoContrast: true,
  luminanceThreshold: 0.2,
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
    // La X de diálogos y hojas también mide 44 px y tiene nombre para el lector de pantalla.
    CloseButton: { defaultProps: { size: 'xl' } },
    Modal: { defaultProps: { radius: 'lg', closeButtonProps: { 'aria-label': 'Cerrar' } } },
    Drawer: { defaultProps: { closeButtonProps: { 'aria-label': 'Cerrar' } } },
    SegmentedControl: {
      defaultProps: { radius: 'md' },
      styles: {
        label: { minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' },
      },
    },
    Tabs: { styles: { tab: { minHeight: 44 } } },
    // El interruptor, igual: su etiqueta también lo cambia y la fila mide 44 px.
    Switch: {
      defaultProps: { size: 'md' },
      styles: {
        body: { alignItems: 'center' },
        label: { minHeight: 44, display: 'flex', alignItems: 'center' },
      },
    },
    // La casilla mide 24 px y su etiqueta, que también la marca, 44 px de alto: la fila completa
    // se toca con un dedo (RNF-09). La casilla queda a la altura del texto aunque haya descripción.
    Checkbox: {
      defaultProps: { size: 'md' },
      styles: {
        inner: { marginTop: 10 },
        label: { minHeight: 44, display: 'flex', alignItems: 'center' },
      },
    },
    // Un tono más claro que el violeta de los botones: sobre el fondo de la noche llega a 6:1.
    Anchor: { defaultProps: { c: 'violeta.3' } },
    // Los campos miden 44 px como los botones (Mantine trae 42 en el tamaño md).
    TextInput: { defaultProps: { size: 'md' }, styles: { input: { minHeight: 44 } } },
    NumberInput: { defaultProps: { size: 'md' }, styles: { input: { minHeight: 44 } } },
    Textarea: { defaultProps: { size: 'md' } },
    Select: { defaultProps: { size: 'md' }, styles: { input: { minHeight: 44 } } },
    NativeSelect: { defaultProps: { size: 'md' }, styles: { input: { minHeight: 44 } } },
    // El ojo que muestra la contraseña ocupa todo el alto del campo: 44 px.
    PasswordInput: {
      defaultProps: {
        size: 'md',
        rightSectionWidth: 44,
        visibilityToggleButtonProps: { 'aria-label': 'Mostrar u ocultar la contraseña' },
      },
      styles: {
        input: { minHeight: 44 },
        innerInput: { minHeight: 42 },
        visibilityToggle: { width: 44, height: 44, minWidth: 44, minHeight: 44 },
      },
    },
  },
});
