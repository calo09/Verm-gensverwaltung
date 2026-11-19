/** Liest eine Datei im Browser mit der gewählten Zeichenkodierung (viele Banken nutzen Windows-1252). */
export async function readFileText(file: File, encoding: "utf-8" | "windows-1252") {
  const buf = await file.arrayBuffer();
  return new TextDecoder(encoding).decode(buf);
}
