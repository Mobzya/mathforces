export function createCsv(rows: Array<Array<number | string | null>>) {
  return (
    "\uFEFF" + rows.map((row) => row.map((value) => escapeCsvCell(value)).join(",")).join("\r\n")
  );
}

export function escapeCsvCell(value: number | string | null) {
  if (value === null) return "";
  let text = String(value).replaceAll("\0", "");
  if (/^[=+\-@\t\r]/.test(text)) {
    text = `'${text}`;
  }
  return `"${text.replaceAll('"', '""')}"`;
}
