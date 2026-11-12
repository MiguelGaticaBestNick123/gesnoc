import '@mantine/core/styles.css';

import { ColorSchemeScript, MantineProvider, mantineHtmlProps } from '@mantine/core';
import type { Metadata, Viewport } from 'next';
import { Barlow } from 'next/font/google';
import { tema } from '@/shared/ui/tema';

// Tipografía de la referencia de diseño: se descarga al compilar y se sirve desde el mismo dominio.
const barlow = Barlow({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--fuente-gesnoc',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'GesNoc',
  description: 'Gestión nocturna para locales con varios ambientes',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#171726',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-CL" className={barlow.variable} {...mantineHtmlProps}>
      <head>
        <ColorSchemeScript defaultColorScheme="dark" />
      </head>
      <body>
        <MantineProvider theme={tema} defaultColorScheme="dark">
          {children}
        </MantineProvider>
      </body>
    </html>
  );
}
