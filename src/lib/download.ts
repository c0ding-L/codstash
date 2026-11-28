/** Saves a blob as a file through a temporary link. Client-only. */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  // After the click has handed the URL to the download.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
