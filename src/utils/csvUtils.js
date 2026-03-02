export function parseCsv(content) {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return [];
  }

  return lines.map((line) => line.split(",").map((value) => value.trim()));
}

export function getSeriesDataFromRows(rows) {
  if (!rows || rows.length < 2) {
    return null;
  }

  const dataRows = rows.slice(1);
  const labels = [];
  const values = [];

  for (const row of dataRows) {
    if (!row || row.length < 2) {
      continue;
    }

    const label = String(row[0] ?? "").trim();
    const numericValue = Number(String(row[1] ?? "").replace(/,/g, ""));

    if (!label || Number.isNaN(numericValue)) {
      continue;
    }

    labels.push(label);
    values.push(numericValue);
  }

  if (labels.length === 0) {
    return null;
  }

  return { labels, values };
}
