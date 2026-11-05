import { AppShell, AppShellMain, AppShellNavbar } from '@mantine/core';
import { Navegacion } from '@/shared/ui/Navegacion';

// Rutas del personal: menú lateral fijo. Qué secciones ve cada persona dependerá
// de su turno de la noche cuando exista la sesión (RF-04).
export default function LayoutPersonal({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <AppShell navbar={{ width: 240, breakpoint: 'sm', collapsed: { mobile: true } }} padding="md">
      <AppShellNavbar p="md">
        <Navegacion />
      </AppShellNavbar>
      <AppShellMain>{children}</AppShellMain>
    </AppShell>
  );
}
