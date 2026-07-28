// lib/db.ts
import { Pool } from 'pg';


let pool: Pool;
const isProduction = process.env.NODE_ENV === 'production';
const databaseUrl = isProduction
  ? process.env.DATABASE_URL
  : process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
const connectionString = databaseUrl?.replace('sslmode=require', 'sslmode=verify-full');
const poolMax = Number(process.env.PG_POOL_MAX || (isProduction ? 5 : 10));


if (!connectionString) {
  throw new Error('DATABASE_URL is required for database access');
}


if (!global._pgPool) {
  pool = new Pool({
    connectionString,
    max: Number.isFinite(poolMax) && poolMax > 0 ? poolMax : 5,
    idleTimeoutMillis: isProduction ? 10000 : 30000,
    connectionTimeoutMillis: 10000,
    keepAlive: true,
    statement_timeout: 30000,
    query_timeout: 30000,
  });
  global._pgPool = pool;
} else {
  pool = global._pgPool;
}


if (!global._pgInFlightReads) {
  global._pgInFlightReads = new Map();
}


export const query = (text: string, params?: any[]) => {
  if (!isReadQuery(text)) {
    return pool.query(text, params);
  }


  const cacheKey = JSON.stringify([text, params || []]);
  const inFlight = global._pgInFlightReads?.get(cacheKey);
  if (inFlight) {
    return inFlight;
  }


  const readPromise = pool.query(text, params).finally(() => {
    global._pgInFlightReads?.delete(cacheKey);
  });


  global._pgInFlightReads?.set(cacheKey, readPromise);
  return readPromise;
};
export default pool;


function isReadQuery(text: string) {
  const normalized = text.trim().toLowerCase();
  return normalized.startsWith('select') || normalized.startsWith('with');
}


// Type declaration for global
declare global {
  var _pgPool: Pool | undefined;
  var _pgInFlightReads: Map<string, Promise<any>> | undefined;
}
