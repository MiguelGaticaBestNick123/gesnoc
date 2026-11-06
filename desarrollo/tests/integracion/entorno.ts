import { cargarEntorno, urlDePruebas } from '../base-pruebas';

cargarEntorno();
process.env.DATABASE_URL = urlDePruebas(process.env.DATABASE_URL);
process.env.DATABASE_URL_MIGRADOR = urlDePruebas(process.env.DATABASE_URL_MIGRADOR);
