import '@mantine/core/styles.css';

import { ColorSchemeScript, MantineProvider, mantineHtmlProps } from '@mantine/core';
import type { Metadata, Viewport } from 'next';
import { tema } from '@/shared/ui/tema';

export const metadata: Metadata = {
  title: 'GesNoc',
  description: 'Gestión nocturna para locales con varios ambientes',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#1a1b1e',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-CL" {...mantineHtmlProps}>
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
