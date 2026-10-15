import { createTheme } from '@mantine/core';

// Objeto simple y no Button.extend(): el tema se arma en el layout, que es un
// componente de servidor, y allí los componentes de Mantine son solo referencias.
export const tema = createTheme({
  primaryColor: 'violet',
  defaultRadius: 'md',
  components: {
    // Botones de al menos 44 px de alto para usarlos con una mano y con poca luz (RNF-09).
    Button: { defaultProps: { size: 'lg' } },
  },
});
