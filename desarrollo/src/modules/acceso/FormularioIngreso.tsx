'use client';

import { PasswordInput, TextInput } from '@mantine/core';
import { FormularioAccion } from '@/shared/ui/FormularioAccion';
import { ingresar } from './acciones';

export function FormularioIngreso() {
  return (
    <FormularioAccion accion={ingresar} textoEnviar="Ingresar">
      <TextInput
        name="correo"
        label="Correo"
        type="email"
        autoComplete="username"
        size="md"
        required
      />
      <PasswordInput
        name="clave"
        label="Contraseña"
        autoComplete="current-password"
        size="md"
        required
      />
    </FormularioAccion>
  );
}
