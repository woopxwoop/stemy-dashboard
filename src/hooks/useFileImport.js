import * as XLSX from "xlsx";
import { parseCsv, getSeriesDataFromRows } from "../utils/csvUtils";

/**
 * Handles CSV / XLSX file selection, parsing, and error reporting.
 * Calls back into the chart component without owning any state itself.
 *
 * @param {{
 *   onDataset: (dataset: object) => void,
 *   onError: (msg: string) => void,
 *   onFileName: (name: string) => void,
 *   onStreamStop: () => void,
 * }} callbacks
 */
export function useFileImport({
  onDataset,
  onError,
  onFileName,
  onStreamStop,
}) {
  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    onError("");
    onFileName(file.name);
    onStreamStop();

    try {
      const ext = file.name.split(".").pop()?.toLowerCase();
      let rows = [];

      if (ext === "csv") {
        rows = parseCsv(await file.text());
      } else if (ext === "xlsx" || ext === "xls") {
        const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) throw new Error("Workbook has no sheets");
        rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
          header: 1,
          raw: false,
        });
      } else {
        throw new Error("Unsupported file type. Use CSV or XLSX.");
      }

      const nextDataset = getSeriesDataFromRows(rows);
      if (!nextDataset) {
        throw new Error(
          "Could not parse chart data. Use 2 columns: label,value.",
        );
      }

      onDataset(nextDataset);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to parse file");
    }
  };

  return { handleFileChange };
}
