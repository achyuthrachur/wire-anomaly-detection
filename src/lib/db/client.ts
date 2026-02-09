import { neon } from '@neondatabase/serverless';

// Lazy-initialize the SQL client to avoid build-time errors
// when POSTGRES_URL isn't available.
let _sql: ReturnType<typeof neon> | null = null;

function getSql() {
  if (!_sql) {
    if (!process.env.POSTGRES_URL) {
      throw new Error('POSTGRES_URL environment variable is not set');
    }
    _sql = neon(process.env.POSTGRES_URL);
  }
  return _sql;
}

// Wrapper that accepts a query string + params array and returns typed results.
export async function sql(query: string, params?: unknown[]) {
  const rawSql = getSql();
  const result = await (rawSql as unknown as (query: string, params?: unknown[]) => Promise<Record<string, unknown>[]>)(query, params);
  return result;
}
