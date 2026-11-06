import { Container } from '@mantine/core';
import { EnConstruccion } from '@/shared/ui/EnConstruccion';

export const metadata = { title: 'Carta · GesNoc' };

// Carta pública de cada mesa: se abre por código QR, sin sesión.
export default function PaginaCarta() {
  return (
    <Container size="sm" py="xl">
      <EnConstruccion
        titulo="Carta"
        descripcion="Productos activos por categoría y botón para llamar al garzón."
        historias={['HU-38', 'HU-39']}
      />
    </Container>
  );
}
