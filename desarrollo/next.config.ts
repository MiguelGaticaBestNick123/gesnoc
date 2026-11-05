import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Imagen Docker liviana: el build deja un servidor autónomo en .next/standalone.
  output: 'standalone',
};

export default nextConfig;
