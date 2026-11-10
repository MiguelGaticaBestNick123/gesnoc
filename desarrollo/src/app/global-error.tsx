'use client';

// Último recurso, si falla el layout raíz. Dibuja su propio documento y no tiene los estilos de
// Mantine, así que va con estilos mínimos en línea.
export default function ErrorGlobal({ retry }: Readonly<{ retry: () => void }>) {
  return (
    <html lang="es-CL">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          background: '#1a1b1e',
          color: '#c9c9c9',
          fontFamily: 'system-ui, sans-serif',
          display: 'grid',
          placeItems: 'center',
        }}
      >
        <main style={{ padding: 24, maxWidth: 380 }}>
          <h1 style={{ fontSize: 22 }}>GesNoc no pudo cargar</h1>
          <p>Revisa la conexión y vuelve a intentarlo.</p>
          <button
            type="button"
            onClick={() => retry()}
            style={{ minHeight: 44, padding: '0 20px', fontSize: 16, borderRadius: 8 }}
          >
            Reintentar
          </button>
        </main>
      </body>
    </html>
  );
}
