import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

type Database = ReturnType<typeof drizzle<typeof schema>>;

let database: Database | null = null;

function getDb(): Database {
  if (database) return database;

  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString)
    throw new Error("Missing environment variable: DATABASE_URL");

  const isSupabase =
    connectionString.includes("supabase.co") ||
    connectionString.includes("pooler.supabase.com");
  const isPooler =
    connectionString.includes("pooler.supabase.com") ||
    connectionString.includes(":6543/");
  const client = postgres(connectionString, {
    max: isPooler ? 5 : 10,
    idle_timeout: 20,
    connect_timeout: 10,
    connection: { statement_timeout: 55000 },
    ssl: isSupabase ? "require" : false,
    prepare: !isPooler,
  });

  database = drizzle(client, { schema });
  return database;
}

// Keep existing call sites concise while delaying all environment reads and SDK
// construction until the first real query at runtime.
export const db = new Proxy({} as Database, {
  get(_target, property) {
    const instance = getDb();
    const value = Reflect.get(instance, property, instance);
    return typeof value === "function" ? value.bind(instance) : value;
  },
});
