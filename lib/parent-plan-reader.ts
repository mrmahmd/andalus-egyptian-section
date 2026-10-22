export const parentReaderDays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"] as const;
export type ParentReaderSize = "normal" | "large" | "larger";

/** Screen typography only: never enlarge Arabic or mixed-script cells with the Latin setting. */
export function parentPlanTextScript(text: string | null | undefined): "latin" | "arabic" | "mixed" | "neutral" {
  const value = text ?? "";
  const arabic = /[\u0600-\u06ff\u0750-\u077f\u0870-\u089f\u08a0-\u08ff\ufb50-\ufdff\ufe70-\ufeff]/.test(value);
  const latin = /[A-Za-z\u00c0-\u024f\u1e00-\u1eff]/.test(value);
  return arabic ? (latin ? "mixed" : "arabic") : latin ? "latin" : "neutral";
}
type ReaderStorage = Pick<Storage, "getItem" | "setItem">;

export function parentReaderSize(value: string | null | undefined): ParentReaderSize {
  return value === "large" || value === "larger" ? value : "normal";
}
export function readParentReaderSize(storage: () => ReaderStorage): ParentReaderSize {
  try { return parentReaderSize(storage().getItem("andalus-parent-reader-size")); }
  catch { return "normal"; }
}
export function rememberParentReaderSize(storage: () => ReaderStorage, size: ParentReaderSize) {
  try { storage().setItem("andalus-parent-reader-size", size); }
  catch { /* Reading controls still work without browser storage. */ }
}
export function selectedReaderDay(day: string | null, available: string[]) {
  return day && available.includes(day) && (parentReaderDays as readonly string[]).includes(day) ? day : null;
}
