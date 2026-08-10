// lib/db.ts
import { Pool } from 'pg';
import type { Business } from './businesses';


const isProduction = process.env.NODE_ENV === 'production';
const databaseUrl = isProduction
  ? process.env.DATABASE_URL
  : process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
const connectionString = databaseUrl?.replace('sslmode=require', 'sslmode=verify-full');
const poolMax = Number(process.env.PG_POOL_MAX || (isProduction ? 5 : 10));


if (!connectionString) {
  throw new Error('DATABASE_URL is required for database access');
}


function createPool(schema?: Business) {
  return new Pool({
    connectionString,
    max: Number.isFinite(poolMax) && poolMax > 0 ? poolMax : 5,
    idleTimeoutMillis: isProduction ? 10000 : 30000,
    connectionTimeoutMillis: 10000,
    keepAlive: true,
    statement_timeout: 30000,
    query_timeout: 30000,
    // Business pools search their own schema first, falling back to public
    // for the shared tables (recruitment_candidates, app_settings).
    options: schema ? `-c search_path=${schema},public` : undefined,
  });
}


if (!global._pgPool) {
  global._pgPool = createPool();
}
const pool = global._pgPool;

if (!global._pgBusinessPools) {
  global._pgBusinessPools = {};
}

function getBusinessPool(business: Business): Pool {
  if (!global._pgBusinessPools![business]) {
    global._pgBusinessPools![business] = createPool(business);
  }
  return global._pgBusinessPools![business]!;
}


if (!global._pgInFlightReads) {
  global._pgInFlightReads = new Map();
}


function isReadQuery(text: string) {
  const normalized = text.trim().toLowerCase();
  return normalized.startsWith('select') || normalized.startsWith('with');
}

function runQuery(targetPool: Pool, cacheNamespace: string, text: string, params?: any[]) {
  if (!isReadQuery(text)) {
    return targetPool.query(text, params);
  }

  const cacheKey = `${cacheNamespace}:${JSON.stringify([text, params || []])}`;
  const inFlight = global._pgInFlightReads?.get(cacheKey);
  if (inFlight) {
    return inFlight;
  }

  const readPromise = targetPool.query(text, params).finally(() => {
    global._pgInFlightReads?.delete(cacheKey);
  });

  global._pgInFlightReads?.set(cacheKey, readPromise);
  return readPromise;
}


// Shared query, scoped to the default `public` schema — use for
// recruitment_candidates and app_settings, which are common across all
// three businesses.
export const query = (text: string, params?: any[]) => runQuery(pool, 'public', text, params);

// Business-scoped query — resolves against that business's schema
// (construction / clove_cafe / clove_guesthouse), falling back to public
// for anything not present in the business schema.
export function queryFor(business: Business) {
  const targetPool = getBusinessPool(business);
  return (text: string, params?: any[]) => runQuery(targetPool, business, text, params);
}

export default pool;


// Type declaration for global
declare global {
  var _pgPool: Pool | undefined;
  var _pgBusinessPools: Partial<Record<Business, Pool>> | undefined;
  var _pgInFlightReads: Map<string, Promise<any>> | undefined;
}
