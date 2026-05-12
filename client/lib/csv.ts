export type CsvRow = Record<string, string | number | boolean | null | undefined>;

const escapeCsv = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (/[",\n]/.test(str)) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
};

export const toCsv = (rows: CsvRow[]): string => {
  const headers = Array.from(
    rows.reduce<Set<string>>((set, row) => {
      Object.keys(row).forEach((k) => set.add(k));
      return set;
    }, new Set<string>())
  );
  const lines = [headers.join(",")];
  for (const row of rows) {
    const line = headers.map((h) => escapeCsv((row as any)[h])).join(",");
    lines.push(line);
  }
  return lines.join("\n");
};

export const downloadCsv = (filename: string, rows: CsvRow[]) => {
  const csv = toCsv(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
