import postgres from "postgres";

let client: ReturnType<typeof postgres> | undefined;

/** Keep the collection endpoint's bound-query interface while using PostgreSQL. */
export function database() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required for My CYI collections");
  client ??= postgres(url, { max: 1, idle_timeout: 20, connect_timeout: 10, prepare: false });
  const sql = client;
  return {
    prepare(statement: string) {
      let parameter = 0;
      // Only application-owned SQL reaches this adapter; visitor values stay bound.
      const query = statement
        .replace(/\b(bookmarks|reflections)\b/g, "cyi.$1")
        .replace(/\?/g, () => `$${++parameter}`);
      return {
        bind(...values: (string | number)[]) {
          const execute = () => sql.unsafe(query, values);
          return {
            async all<T>() { return { results: Array.from(await execute()) as T[] }; },
            async first<T>() { return ((await execute())[0] as T | undefined) ?? null; },
            async run() { await execute(); },
          };
        },
      };
    },
  };
}
