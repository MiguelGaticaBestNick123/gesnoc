'use client';

import { Alert, Card, PasswordInput, Stack, Text } from '@mantine/core';
import { IconKey } from '@tabler/icons-react';
import { useCallback, useState } from 'react';
import { EncabezadoPagina } from '@/shared/ui/EncabezadoPagina';
import { FormularioAccion } from '@/shared/ui/FormularioAccion';
import { cambiarMiClave } from './acciones';

/**
 * Brecha 5: la persona cambia su propia contraseña. Al terminar, el formulario se vacía (se vuelve a
 * montar) para que la contraseña no quede escrita en la pantalla.
 */
export function MiClave() {
  const [cambios, setCambios] = useState(0);
  const terminar = useCallback(() => setCambios((n) => n + 1), []);

  return (
    <Stack gap="md" maw={480}>
      <EncabezadoPagina
        icono={IconKey}
        titulo="Mi contraseña"
        descripcion="Solo tú la conoces: la administración puede restablecerla, pero no verla."
      />
      {cambios > 0 && (
        <Alert color="green" variant="light" role="status">
          Listo: tu contraseña cambió. Si tenías la sesión abierta en otro teléfono, se cerró.
        </Alert>
      )}
      <Card withBorder padding="md">
        <FormularioAccion
          key={cambios}
          accion={cambiarMiClave}
          textoEnviar="Cambiar contraseña"
          alTerminar={terminar}
        >
          <PasswordInput name="actual" label="Contraseña actual" autoComplete="current-password" />
          <PasswordInput
            name="nueva"
            label="Contraseña nueva"
            description="Mínimo 8 caracteres."
            autoComplete="new-password"
          />
          <PasswordInput
            name="repetida"
            label="Repite la contraseña nueva"
            autoComplete="new-password"
          />
          <Text size="sm" c="dimmed">
            Al cambiarla se cierran tus demás sesiones abiertas; en este teléfono sigues dentro.
          </Text>
        </FormularioAccion>
      </Card>
    </Stack>
  );
}
