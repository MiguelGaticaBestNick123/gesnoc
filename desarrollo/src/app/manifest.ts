import type { MetadataRoute } from 'next';

// La aplicación se puede instalar en la pantalla de inicio del teléfono, como la usaba el local.
// Sin service worker: nada se guarda en caché, así que después de cada despliegue se ve la versión
// nueva y no hay modo sin conexión (fuera del alcance).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'GesNoc',
    short_name: 'GesNoc',
    description: 'Gestión nocturna para locales con varios ambientes',
    lang: 'es-CL',
    start_url: '/',
    display: 'standalone',
    background_color: '#171726',
    theme_color: '#171726',
    icons: [
      { src: '/icono-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icono-512.png', sizes: '512x512', type: 'image/png' },
      {
        src: '/icono-recortable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
