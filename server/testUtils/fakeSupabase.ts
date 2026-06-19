// In-memory Supabase client stand-in for unit-testing Platform Growth Phase 2
// services. Broader filter support than server/services/leads/fakeSupabase.ts
// (adds not/gte/lte/gt/lt/neq) since these services use date-range and
// exclusion filters that leadService.ts doesn't.

export type Row = Record<string, any>;

type Filter = (row: Row) => boolean;

function randomId(): string {
  return `id-${Math.random().toString(36).slice(2, 10)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * uniqueColumns: optional, e.g. { blog_posts: ["slug"] } — opt-in per table,
 * so existing tests that don't pass this are completely unaffected. When a
 * configured column collides with an existing row on insert, returns a
 * Postgres-shaped { code: "23505" } error instead of inserting, matching
 * real unique-constraint-violation behavior closely enough for application
 * code that branches on error.code.
 */
export function createFakeSupabase(
  initialTables: Record<string, Row[]> = {},
  uniqueColumns: Record<string, string[]> = {},
) {
  const tables: Record<string, Row[]> = {};
  for (const [name, rows] of Object.entries(initialTables)) {
    tables[name] = rows.map((row) => ({ ...row }));
  }

  function from(table: string) {
    if (!tables[table]) tables[table] = [];
    const rows = tables[table];

    let mode: "select" | "insert" | "update" = "select";
    let payload: Row | Row[] | null = null;
    let withCount = false;
    let wantsData = false;
    const filters: Filter[] = [];
    let orderSpec: { column: string; ascending: boolean } | null = null;
    let limitSpec: number | null = null;

    function matchAll(row: Row): boolean {
      return filters.every((f) => f(row));
    }

    function execute(): { data: any; error: any; count?: number } {
      if (mode === "insert") {
        const items = Array.isArray(payload) ? payload : [payload as Row];
        const uniqueCols = uniqueColumns[table] ?? [];
        for (const item of items) {
          for (const col of uniqueCols) {
            if (item[col] != null && rows.some((r) => r[col] === item[col])) {
              return {
                data: null,
                error: { code: "23505", message: `duplicate key value violates unique constraint on ${table}.${col}` },
              };
            }
          }
        }
        const inserted = items.map((item) => {
          const now = new Date().toISOString();
          const row: Row = { id: randomId(), created_at: now, updated_at: now, ...item };
          rows.push(row);
          return { ...row };
        });
        return { data: wantsData ? (Array.isArray(payload) ? inserted : inserted[0]) : null, error: null, count: inserted.length };
      }

      if (mode === "update") {
        const matched = rows.filter(matchAll);
        for (const row of matched) Object.assign(row, payload);
        return { data: wantsData ? matched.map((r) => ({ ...r })) : null, error: null, count: matched.length };
      }

      let result = rows.filter(matchAll).map((r) => ({ ...r }));
      const total = result.length;

      if (orderSpec) {
        const { column, ascending } = orderSpec;
        result = [...result].sort((a, b) => {
          const av = a[column];
          const bv = b[column];
          if (av === bv) return 0;
          return (av > bv ? 1 : -1) * (ascending ? 1 : -1);
        });
      }

      if (limitSpec != null) result = result.slice(0, limitSpec);

      return { data: result, error: null, count: withCount ? total : undefined };
    }

    const builder: any = {
      select(_cols?: string, opts?: { count?: string; head?: boolean }) {
        if (mode !== "insert" && mode !== "update") mode = "select";
        if (opts?.count) withCount = true;
        wantsData = true;
        return builder;
      },
      insert(item: Row | Row[]) {
        mode = "insert";
        payload = item;
        return builder;
      },
      update(item: Row) {
        mode = "update";
        payload = item;
        return builder;
      },
      eq(col: string, val: any) {
        filters.push((row) => row[col] === val);
        return builder;
      },
      neq(col: string, val: any) {
        filters.push((row) => row[col] !== val);
        return builder;
      },
      gte(col: string, val: any) {
        filters.push((row) => row[col] != null && row[col] >= val);
        return builder;
      },
      lte(col: string, val: any) {
        filters.push((row) => row[col] != null && row[col] <= val);
        return builder;
      },
      gt(col: string, val: any) {
        filters.push((row) => row[col] != null && row[col] > val);
        return builder;
      },
      lt(col: string, val: any) {
        filters.push((row) => row[col] != null && row[col] < val);
        return builder;
      },
      in(col: string, vals: any[]) {
        filters.push((row) => vals.includes(row[col]));
        return builder;
      },
      // Supports the two patterns actually used in this codebase:
      //   .not("col", "is", null)   -> col IS NOT NULL
      //   .not("col", "in", "(\"a\",\"b\")") -> col NOT IN (a, b)
      not(col: string, op: string, val: any) {
        if (op === "is") {
          filters.push((row) => row[col] !== val);
        } else if (op === "in") {
          const list = String(val)
            .replace(/^\(|\)$/g, "")
            .split(",")
            .map((s) => s.replace(/"/g, "").trim());
          filters.push((row) => !list.includes(row[col]));
        }
        return builder;
      },
      order(column: string, opts?: { ascending?: boolean }) {
        orderSpec = { column, ascending: opts?.ascending ?? true };
        return builder;
      },
      limit(n: number) {
        limitSpec = n;
        return builder;
      },
      async maybeSingle() {
        wantsData = true;
        const { data, error } = execute();
        const arr = Array.isArray(data) ? data : data ? [data] : [];
        return { data: arr[0] ?? null, error };
      },
      async single() {
        wantsData = true;
        const { data, error } = execute();
        if (error) return { data: null, error };
        const arr = Array.isArray(data) ? data : data ? [data] : [];
        if (arr.length === 0) return { data: null, error: { message: "No rows found" } };
        return { data: arr[0], error: null };
      },
      then(resolve: (value: any) => any, reject?: (reason: any) => any) {
        return Promise.resolve(execute()).then(resolve, reject);
      },
    };

    return builder;
  }

  return { from, tables };
}

export type FakeSupabase = ReturnType<typeof createFakeSupabase>;
