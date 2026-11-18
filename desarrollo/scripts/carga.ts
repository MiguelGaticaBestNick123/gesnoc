// Prueba de carga de una noche completa (EV-07; RNF-04, RNF-05 y RNF-06): 40 dispositivos contra la
// compilación de producción en este computador, con la base de pruebas. Cada dispositivo hace lo
// que haría su pantalla: los garzones abren cuentas, piden, entregan, atienden llamados y cobran; la
// barra y la cocina marcan listo; la puerta busca y registra ingresos; la administración mira el
// resumen y los clientes llaman desde la carta. Todas las pantallas consultan su estado cada 3 s,
// como `useTiempoReal`. La noche se reparte entre dos instancias del servidor, que no guardan
// estado propio (RNF-06): un pedido enviado a una la ve la estación conectada a la otra.
//
// Mide:
// - RNF-04: cuánto tarda enviar un pedido, registrar un pago y registrar un ingreso (p95 ≤ 800 ms).
// - RNF-05: cuánto tarda un cambio en verse en otro dispositivo (p95 ≤ 5 s): el pedido nuevo en la
//   estación y la comanda lista en el teléfono del garzón.
// - Al final revisa la base: ningún pedido, pago ni ingreso duplicado, y tickets sin saltos.
//
// Uso: npm run build && npm run carga
// Borra y vuelve a sembrar la base `gesnoc_pruebas`; se niega a correr contra un host remoto.
import { spawn, type ChildProcess } from 'node:child_process';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import postgres from 'postgres';
import { digitoVerificador } from '../src/shared/utilidades/rut.ts';
import { cargarEntorno, reiniciarBaseDePruebas, urlDePruebas } from '../tests/base-pruebas.ts';

cargarEntorno();

const PUERTOS = [3200, 3201];
const META = { pedidos: 300, ingresos: 400 };
/** El sondeo de `useTiempoReal`. */
const CADA = 3000;

const dormir = (ms: number) => new Promise((listo) => setTimeout(listo, ms));
const entre = (minimo: number, maximo: number) =>
  minimo + Math.floor(Math.random() * (maximo - minimo + 1));
const uno = <T>(lista: readonly T[]): T => lista[Math.floor(Math.random() * lista.length)]!;
const rut = (cuerpo: number) => `${cuerpo}-${digitoVerificador(String(cuerpo))}`;

// ---------------------------------------------------------------------------------------------
// Tiempos y errores, por operación.

const tiempos = new Map<string, number[]>();
const errores = new Map<string, { cantidad: number; ejemplo: string }>();

function anotar(operacion: string, ms: number) {
  const lista = tiempos.get(operacion) ?? [];
  lista.push(ms);
  tiempos.set(operacion, lista);
}

function percentil(valores: number[], p: number) {
  const orden = [...valores].sort((a, b) => a - b);
  return orden[Math.max(0, Math.ceil((p / 100) * orden.length) - 1)] ?? 0;
}

interface Respuesta<T> {
  ok: boolean;
  status: number;
  datos: T;
}

/** Una petición del teléfono, con su cookie de sesión; anota cuánto tardó y si falló sin motivo. */
async function pedir<T>(
  base: string,
  ruta: string,
  operacion: string,
  {
    token,
    cuerpo,
    esperados = [],
  }: { token?: string; cuerpo?: unknown; esperados?: number[] } = {},
): Promise<Respuesta<T>> {
  const inicio = performance.now();
  const respuesta = await fetch(base + ruta, {
    method: cuerpo === undefined ? 'GET' : 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { cookie: `gesnoc_sesion=${token}` } : {}),
    },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
  const datos = (await respuesta.json().catch(() => null)) as T;
  anotar(operacion, performance.now() - inicio);
  if (!respuesta.ok && !esperados.includes(respuesta.status)) {
    const previo = errores.get(operacion);
    errores.set(operacion, {
      cantidad: (previo?.cantidad ?? 0) + 1,
      ejemplo: previo?.ejemplo ?? `${respuesta.status} ${JSON.stringify(datos)}`,
    });
  }
  return { ok: respuesta.ok, status: respuesta.status, datos };
}

// ---------------------------------------------------------------------------------------------
// RNF-05: un cambio hecho en un dispositivo y el momento en que otro lo ve. Si el otro lo ve antes
// de que la respuesta llegue al primero, la demora cuenta como cero.

const hecho = new Map<string, number>();
const visto = new Map<string, number>();
const medidas = new Set<string>();

function cuandoSeHizo(operacion: string, llave: string) {
  hecho.set(`${operacion}|${llave}`, performance.now());
  medirSiSePuede(operacion, llave);
}

function cuandoSeVio(operacion: string, llave: string) {
  if (!visto.has(`${operacion}|${llave}`)) visto.set(`${operacion}|${llave}`, performance.now());
  medirSiSePuede(operacion, llave);
}

function medirSiSePuede(operacion: string, llave: string) {
  const clave = `${operacion}|${llave}`;
  const desde = hecho.get(clave);
  const hasta = visto.get(clave);
  if (desde === undefined || hasta === undefined || medidas.has(clave)) return;
  medidas.add(clave);
  anotar(operacion, Math.max(0, hasta - desde));
}

// ---------------------------------------------------------------------------------------------
// El local y las sesiones de los 40 dispositivos.

const migrador = postgres(urlDePruebas(process.env.DATABASE_URL_MIGRADOR), {
  max: 2,
  onnotice: () => {},
});

async function sesion(persona: string) {
  const token = randomBytes(32).toString('base64url');
  const hash = createHash('sha256').update(token).digest();
  await migrador`
    insert into gesnoc.sesion (token_hash, usuario_id, expira_en)
    select ${hash}, id, now() + interval '12 hours' from gesnoc.usuario
    where correo = ${`${persona}@gesnoc.test`}`;
  return token;
}

interface Producto {
  id: number;
  nombre: string;
  comida: boolean;
}

const estado = { pedidos: 0, ingresos: 0, garzonesActivos: 0, fin: false };

/** Una pantalla que consulta su estado cada 3 s mientras dure la noche. */
async function sondear<T>(
  base: string,
  token: string | undefined,
  ruta: string,
  alRecibir?: (datos: T) => Promise<void> | void,
) {
  await dormir(Math.random() * CADA);
  while (!estado.fin) {
    const inicio = performance.now();
    const respuesta = await pedir<T>(base, ruta, `consultar ${ruta.split('?')[0]}`, { token });
    if (respuesta.ok && alRecibir) await alRecibir(respuesta.datos);
    await dormir(Math.max(0, CADA - (performance.now() - inicio)));
  }
}

interface MisComandas {
  listas: { pedido: number; estacionId: number }[];
  llamados: { numero: number }[];
}

/** Un garzón: abre cuentas de clientes, pide cada tanto, entrega lo listo, atiende y cobra. */
async function garzon(
  dispositivo: number,
  base: string,
  token: string,
  ambienteId: number,
  productos: Producto[],
) {
  let pendientes: MisComandas = { listas: [], llamados: [] };
  const consultas = [
    sondear<MisComandas>(base, token, '/api/vivo/comandas', (datos) => {
      pendientes = datos;
      for (const c of datos.listas)
        cuandoSeVio('RNF-05: lista → garzón', `${c.pedido}:${c.estacionId}`);
    }),
    sondear(base, token, '/api/vivo/mesas'),
  ];
  estado.garzonesActivos += 1;
  for (let cliente = 1; estado.pedidos < META.pedidos; cliente++) {
    const abierta = await pedir<{ numero: number }>(base, '/api/cuentas', 'abrir cuenta', {
      token,
      cuerpo: { ambienteId, referencia: `Cliente ${dispositivo}-${cliente}` },
    });
    if (!abierta.ok) {
      await dormir(3000);
      continue;
    }
    const cuenta = abierta.datos.numero;
    const rondas = entre(3, 7);
    for (let ronda = 0; ronda < rondas && estado.pedidos < META.pedidos; ronda++) {
      await dormir(entre(6000, 16000));
      if (estado.pedidos >= META.pedidos) break;
      estado.pedidos += 1;
      const lineas = [uno(productos.filter((p) => !p.comida))];
      if (Math.random() < 0.3) lineas.push(uno(productos.filter((p) => p.comida)));
      const enviado = await pedir<{ numero: number }>(
        base,
        '/api/pedidos',
        'RNF-04: enviar pedido',
        {
          token,
          cuerpo: {
            cuenta,
            claveEnvio: randomUUID(),
            personas: lineas.some((p) => p.comida) ? entre(1, 6) : null,
            // Como el teléfono: una línea sin nota lleva el texto vacío.
            lineas: lineas.map((p) => ({ productoId: p.id, cantidad: entre(1, 3), nota: '' })),
          },
        },
      );
      if (enviado.ok) cuandoSeHizo('RNF-05: pedido → estación', String(enviado.datos.numero));
      else estado.pedidos -= 1;
      // Lo que quedó listo se retira, y la mesa que llama se atiende.
      for (const c of pendientes.listas) {
        await pedir(base, '/api/comandas/entregada', 'entregar comanda', {
          token,
          cuerpo: { pedido: c.pedido, estacionId: c.estacionId },
          esperados: [409],
        });
      }
      for (const l of pendientes.llamados) {
        await pedir(base, '/api/llamados/atendido', 'atender llamado', {
          token,
          cuerpo: { numero: l.numero },
          esperados: [409],
        });
      }
    }
    // El cobro: el saldo de la cuenta en una a tres partes, cada una con su medio y su propina.
    const detalle = await pedir<{ saldo: number }>(
      base,
      `/api/vivo/cuenta?numero=${cuenta}`,
      'consultar cuenta',
      { token },
    );
    let saldo = detalle.ok ? detalle.datos.saldo : 0;
    const partes = entre(1, 3);
    for (let parte = 0; parte < partes && saldo > 0; parte++) {
      const faltan = partes - parte;
      const monto = faltan === 1 ? saldo : Math.min(saldo, Math.ceil(saldo / faltan / 10) * 10);
      const pagado = await pedir<{ saldo: number }>(base, '/api/pagos', 'RNF-04: registrar pago', {
        token,
        cuerpo: {
          cuenta,
          claveEnvio: randomUUID(),
          medio: uno(['efectivo', 'tarjeta', 'transferencia']),
          monto,
          propina: Math.random() < 0.5 ? Math.round(monto / 100) * 10 : 0,
        },
      });
      if (pagado.ok) saldo = pagado.datos.saldo;
    }
  }
  estado.garzonesActivos -= 1;
  await Promise.all(consultas);
}

interface Cola {
  estacion: { id: number } | null;
  pendientes: { pedido: number; espera: number; anulada: boolean }[];
}

/** Una tablet de barra o de cocina: ve llegar los pedidos y los marca listos al prepararlos. */
async function estacion(base: string, token: string, tipo: 'barra' | 'cocina') {
  const preparacion = tipo === 'barra' ? 8 : 20; // segundos
  await sondear<Cola>(base, token, `/api/vivo/cola?tipo=${tipo}`, async (cola) => {
    if (!cola.estacion) return;
    const estacionId = cola.estacion.id;
    for (const c of cola.pendientes) cuandoSeVio('RNF-05: pedido → estación', String(c.pedido));
    for (const c of cola.pendientes.filter((c) => !c.anulada && c.espera >= preparacion)) {
      const marcada = await pedir<{ yaEstaba: boolean }>(
        base,
        '/api/comandas/lista',
        'marcar lista',
        { token, cuerpo: { pedido: c.pedido, estacionId } },
      );
      if (marcada.ok && !marcada.datos.yaEstaba) {
        cuandoSeHizo('RNF-05: lista → garzón', `${c.pedido}:${estacionId}`);
      }
    }
  });
}

/** Un teléfono de la puerta: busca a cada persona por su RUT y registra su entrada. */
async function puerta(dispositivo: number, base: string, token: string, precio: number) {
  const consulta = sondear(base, token, '/api/vivo/puerta');
  for (let i = 0; estado.ingresos < META.ingresos; i++) {
    await dormir(entre(2000, 7000));
    if (estado.ingresos >= META.ingresos) break;
    estado.ingresos += 1;
    const documento = rut(30_000_000 + dispositivo * 1000 + i);
    await pedir(base, '/api/puerta/buscar', 'buscar en la puerta', {
      token,
      cuerpo: { tipoDocumento: 'rut', documento },
    });
    const forma = uno([
      'efectivo',
      'efectivo',
      'tarjeta',
      'tarjeta',
      'pendiente',
      'gratis',
    ] as const);
    const registrado = await pedir(base, '/api/puerta/entradas', 'RNF-04: registrar ingreso', {
      token,
      cuerpo: {
        tipoDocumento: 'rut',
        documento,
        nombre: 'Visita',
        apellido: `Número ${dispositivo}-${i}`,
        forma,
        monto: forma === 'gratis' ? 0 : precio,
      },
    });
    if (!registrado.ok) estado.ingresos -= 1;
  }
  await consulta;
}

/** Un cliente con la carta de su mesa: llama al garzón cada tanto. */
async function carta(base: string, codigo: string) {
  while (!estado.fin) {
    await dormir(entre(20_000, 45_000));
    if (estado.fin) break;
    // Antes de 60 s desde el último llamado de la mesa, el servidor lo informa con un 409 (RN-29).
    await pedir(base, `/api/carta/${codigo}/llamado`, 'llamar al garzón', {
      cuerpo: {},
      esperados: [409],
    });
  }
}

// ---------------------------------------------------------------------------------------------

function levantar(puerto: number): ChildProcess {
  return spawn(process.execPath, ['server.js'], {
    cwd: '.next/standalone',
    stdio: ['ignore', 'ignore', 'inherit'],
    env: {
      ...process.env,
      NODE_ENV: 'production',
      PORT: String(puerto),
      HOSTNAME: '127.0.0.1',
      DATABASE_URL: urlDePruebas(process.env.DATABASE_URL),
      SESION_SIN_HTTPS: '1',
    },
  });
}

async function esperarSalud(base: string) {
  for (let intento = 0; intento < 120; intento++) {
    const respuesta = await fetch(`${base}/api/salud`).catch(() => null);
    if (respuesta?.ok) return;
    await dormir(500);
  }
  throw new Error(`El servidor de ${base} no respondió`);
}

const ms = (valor: number) => `${Math.round(valor)} ms`;

async function principal() {
  if (!existsSync('.next/standalone/server.js')) {
    throw new Error('Falta la compilación de producción: corre `npm run build`');
  }
  console.log('Preparando la base de pruebas y la noche…');
  await reiniciarBaseDePruebas();
  const [noche] = await migrador<{ fecha: string; precio: number }[]>`
    select n.fecha::text as fecha, n.precio_entrada as precio from gesnoc.noche n
    where n.abierta_en is null
      and exists (select 1 from gesnoc.asignacion a where a.fecha = n.fecha)
    order by n.fecha limit 1`;
  await migrador`update gesnoc.noche set abierta_en = now() where fecha = ${noche!.fecha}`;
  await migrador`insert into gesnoc.arqueo (fecha, fondo_inicial) values (${noche!.fecha}, 50000)`;

  const ambientes = await migrador<{ id: number; nombre: string }[]>`
    select id, nombre from gesnoc.ambiente order by id`;
  const productos = await migrador<Producto[]>`
    select p.id, p.nombre, c.nombre = 'Comida' as comida
    from gesnoc.producto p join gesnoc.categoria c on c.id = p.categoria_id`;
  const codigos = await migrador<{ token_qr: string }[]>`
    select token_qr from gesnoc.mesa order by random() limit 4`;
  const ambienteDe = (nombre: string) => ambientes.find((a) => a.nombre === nombre)!.id;

  console.log(`Levantando ${PUERTOS.length} instancias del servidor…`);
  const servidores = PUERTOS.map(levantar);
  // Si la prueba se interrumpe, los servidores no quedan escuchando.
  process.on('exit', () => servidores.forEach((servidor) => servidor.kill()));
  const bases = PUERTOS.map((puerto) => `http://127.0.0.1:${puerto}`);
  try {
    await Promise.all(bases.map(esperarSalud));
    // Una vuelta de calentamiento: la primera petición de cada ruta compila y conecta.
    for (const base of bases) await fetch(`${base}/api/salud`);

    const instancia = (i: number) => bases[i % bases.length]!;
    const dispositivos: Promise<void>[] = [];
    let n = 0;
    // 16 garzones (8 por ambiente), 6 tablets de barra (3 por ambiente), 4 de cocina, 8 teléfonos
    // en la puerta, 2 de la administración y 4 clientes con la carta: 40 dispositivos.
    for (let i = 0; i < 8; i++) {
      dispositivos.push(
        garzon(n, instancia(n++), await sesion('garzon'), ambienteDe('Salón'), productos),
      );
      dispositivos.push(
        garzon(n, instancia(n++), await sesion('garzon2'), ambienteDe('Terraza'), productos),
      );
    }
    for (let i = 0; i < 3; i++) {
      dispositivos.push(estacion(instancia(n++), await sesion('barra'), 'barra'));
      dispositivos.push(estacion(instancia(n++), await sesion('barra2'), 'barra'));
    }
    for (let i = 0; i < 4; i++)
      dispositivos.push(estacion(instancia(n++), await sesion('cocina'), 'cocina'));
    for (let i = 0; i < 8; i++) {
      dispositivos.push(puerta(i, instancia(n++), await sesion('guardia'), noche!.precio));
    }
    for (let i = 0; i < 2; i++)
      dispositivos.push(sondear(instancia(n++), await sesion('admin'), '/api/vivo/resumen'));
    for (const { token_qr: codigo } of codigos) dispositivos.push(carta(instancia(n++), codigo));
    console.log(`${n} dispositivos conectados. Comienza la noche…`);

    const inicio = performance.now();
    const avance = setInterval(() => {
      console.log(
        `  ${Math.round((performance.now() - inicio) / 1000)} s · ${estado.pedidos} pedidos · ${estado.ingresos} ingresos`,
      );
    }, 30_000);
    // La noche termina cuando se enviaron los pedidos y se registraron los ingresos.
    while (
      estado.pedidos < META.pedidos ||
      estado.ingresos < META.ingresos ||
      estado.garzonesActivos > 0
    ) {
      await dormir(1000);
      // Una operación que falla una y otra vez no es carga: es un error del script o del sistema.
      const fallando = [...errores].find(([, falla]) => falla.cantidad > 25);
      if (fallando) {
        throw new Error(`«${fallando[0]}» falla una y otra vez: ${fallando[1].ejemplo}`);
      }
    }
    await dormir(2 * CADA); // las últimas consultas
    estado.fin = true;
    clearInterval(avance);
    await Promise.all(dispositivos);
    const duracion = (performance.now() - inicio) / 1000;

    // --- Integridad: lo registrado es lo que los dispositivos recibieron como hecho ---
    const [conteos] = await migrador<
      {
        pedidos: number;
        pagos: number;
        entradas: number;
        tickets: number;
        maximo: number;
        excedidas: number;
      }[]
    >`
      select
        (select count(*) from gesnoc.pedido where fecha = ${noche!.fecha})::int as pedidos,
        (select count(*) from gesnoc.pago where fecha = ${noche!.fecha})::int as pagos,
        (select count(*) from gesnoc.entrada where fecha = ${noche!.fecha})::int as entradas,
        (select count(distinct ticket) from gesnoc.entrada where fecha = ${noche!.fecha})::int as tickets,
        (select coalesce(max(ticket), 0) from gesnoc.entrada where fecha = ${noche!.fecha})::int as maximo,
        (select count(*) from gesnoc.cuenta c where c.fecha = ${noche!.fecha}
           and (select coalesce(sum(monto), 0) from gesnoc.pago p
                where p.fecha = c.fecha and p.cuenta_numero = c.numero)
             > (select coalesce(sum(d.cantidad * d.precio_unitario), 0) from gesnoc.pedido p
                join gesnoc.detalle_pedido d on d.fecha = p.fecha and d.pedido_numero = p.numero
                where p.fecha = c.fecha and p.cuenta_numero = c.numero and d.anulado_en is null)
        )::int as excedidas`;
    const exitosas = (operacion: string) =>
      (tiempos.get(operacion)?.length ?? 0) - (errores.get(operacion)?.cantidad ?? 0);

    // --- Informe ---
    const total = [...tiempos.values()].reduce((suma, lista) => suma + lista.length, 0);
    console.log(
      `\n## Prueba de carga · ${new Date().toISOString().slice(0, 16).replace('T', ' ')}\n`,
    );
    console.log(
      `${n} dispositivos · ${PUERTOS.length} instancias · ${Math.round(duracion)} s · ${total} peticiones (${(total / duracion).toFixed(1)} por segundo)\n`,
    );
    console.log('| Operación | n | p50 | p95 | p99 | máx. | errores |');
    console.log('|-|-|-|-|-|-|-|');
    for (const [operacion, lista] of [...tiempos].sort(([a], [b]) => a.localeCompare(b))) {
      const fallas = errores.get(operacion);
      console.log(
        `| ${operacion} | ${lista.length} | ${ms(percentil(lista, 50))} | ${ms(percentil(lista, 95))} | ${ms(percentil(lista, 99))} | ${ms(Math.max(...lista))} | ${fallas ? `${fallas.cantidad} (${fallas.ejemplo})` : 0} |`,
      );
    }
    console.log('\n| Verificación | Resultado |');
    console.log('|-|-|');
    const p95 = (operacion: string) => percentil(tiempos.get(operacion) ?? [0], 95);
    for (const operacion of [
      'RNF-04: enviar pedido',
      'RNF-04: registrar pago',
      'RNF-04: registrar ingreso',
    ]) {
      console.log(
        `| ${operacion}: p95 ≤ 800 ms | ${p95(operacion) <= 800 ? 'cumple' : 'NO CUMPLE'} (${ms(p95(operacion))}) |`,
      );
    }
    for (const operacion of ['RNF-05: pedido → estación', 'RNF-05: lista → garzón']) {
      console.log(
        `| ${operacion}: p95 ≤ 5 s | ${p95(operacion) <= 5000 ? 'cumple' : 'NO CUMPLE'} (${ms(p95(operacion))}) |`,
      );
    }
    console.log(
      `| Pedidos registrados = enviados con éxito | ${conteos!.pedidos === exitosas('RNF-04: enviar pedido') ? 'cumple' : 'NO CUMPLE'} (${conteos!.pedidos}) |`,
    );
    console.log(
      `| Pagos registrados = cobrados con éxito | ${conteos!.pagos === exitosas('RNF-04: registrar pago') ? 'cumple' : 'NO CUMPLE'} (${conteos!.pagos}) |`,
    );
    console.log(
      `| Ingresos registrados = enviados con éxito | ${conteos!.entradas === exitosas('RNF-04: registrar ingreso') ? 'cumple' : 'NO CUMPLE'} (${conteos!.entradas}) |`,
    );
    console.log(
      `| Tickets únicos y sin saltos (OE3) | ${conteos!.tickets === conteos!.maximo ? 'cumple' : 'NO CUMPLE'} (${conteos!.tickets} de ${conteos!.maximo}) |`,
    );
    console.log(
      `| Ninguna cuenta cobra más que su consumo (RN-18) | ${conteos!.excedidas === 0 ? 'cumple' : 'NO CUMPLE'} |`,
    );
  } finally {
    for (const servidor of servidores) servidor.kill();
    await migrador.end();
  }
}

await principal();
