import type { NextConfig } from 'next';

const desarrollo = process.env.NODE_ENV === 'development';

// Todo sale del mismo dominio: next/font sirve la fuente desde /_next, no hay CDN ni analítica. Next y
// el script de esquema de color de Mantine van en línea, y Mantine usa estilos en línea: sin nonces,
// eso exige 'unsafe-inline'. Lo que más protege aquí es frame-ancestors: nadie puede enmarcar la app
// para que alguien toque «Cerrar la noche» sin saberlo.
const politica = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${desarrollo ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  `connect-src 'self'${desarrollo ? ' ws:' : ''}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

const cabeceras = [
  { key: 'Content-Security-Policy', value: politica },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'same-origin' },
  // La pantalla siempre encendida (barra y cocina) y el plano a pantalla completa son propios.
  {
    key: 'Permissions-Policy',
    value:
      'camera=(), microphone=(), geolocation=(), payment=(), usb=(), screen-wake-lock=(self), fullscreen=(self)',
  },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  // Por http (npm run local en la red del local) el navegador la ignora; en Railway rige.
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
];

const nextConfig: NextConfig = {
  // Imagen Docker liviana: el build deja un servidor autónomo en .next/standalone.
  output: 'standalone',
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: cabeceras }];
  },
};

export default nextConfig;
