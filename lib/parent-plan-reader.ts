export const parentReaderDays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"] as const;
export type ParentReaderSize = "normal" | "large" | "larger";
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
