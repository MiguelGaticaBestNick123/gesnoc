try {
  process.loadEnvFile();
} catch {
  // Sin .env (CI): las variables ya vienen del entorno.
}

if (!process.env.DATABASE_URL) {
  throw new Error(
    'Las pruebas de integración necesitan DATABASE_URL: levanta la base con `docker compose up -d db migrar`.',
  );
}
