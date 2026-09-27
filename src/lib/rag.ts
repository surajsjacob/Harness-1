export type DocChunk = { doc: string; page: number; text: string };
export function chunkDoc(name: string, pages: string[], size = 3000, overlap = 400): DocChunk[] {
  const out: DocChunk[] = [];
  pages.forEach((p, i) => {
    const t = p.replace(/\s+/g, " ").trim();
    for (let s = 0; s < t.length; s += size - overlap) { out.push({ doc: name, page: i + 1, text: t.slice(s, s + size) }); if (s + size >= t.length) break; }
  });
  return out;
}
const STOP = new Set("a an the and or of to in on for is are was were be by with as at it this that from what which who how why when where do does did can i you we they".split(" "));
const tok = (s: string) => s.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(w => w.length > 1 && !STOP.has(w));
export function bm25Top(chunks: DocChunk[], query: string, k = 8): DocChunk[] {
  const q = Array.from(new Set(tok(query))); if (!q.length || !chunks.length) return chunks.slice(0, k);
  const docs = chunks.map(c => tok(c.text)); const N = docs.length; const avg = docs.reduce((n, d) => n + d.length, 0) / N || 1;
  const df: Record<string, number> = {}; for (const d of docs) for (const w of new Set(d)) df[w] = (df[w] || 0) + 1;
  const scored = docs.map((d, i) => { const tf: Record<string, number> = {}; for (const w of d) tf[w] = (tf[w] || 0) + 1; let s = 0;
    for (const w of q) { if (!tf[w]) continue; const idf = Math.log(1 + (N - df[w] + 0.5) / (df[w] + 0.5)); s += idf * (tf[w] * 2.2) / (tf[w] + 1.2 * (0.25 + 0.75 * d.length / avg)); }
    return { i, s }; });
  const top = scored.filter(x => x.s > 0).sort((a, b) => b.s - a.s).slice(0, k).map(x => chunks[x.i]);
  return top.length ? top : chunks.slice(0, k);
}
export function buildDocContext(docs: { name: string; pages: string[] }[], question: string, fullTextLimit = 60000): string {
  if (!docs.length) return "";
  const total = docs.reduce((n, d) => n + d.pages.join(" ").length, 0);
  let excerpts: DocChunk[];
  if (total <= fullTextLimit) excerpts = docs.flatMap(d => d.pages.map((p, i) => ({ doc: d.name, page: i + 1, text: p })));
  else excerpts = bm25Top(docs.flatMap(d => chunkDoc(d.name, d.pages)), question, 8);
  const body = excerpts.filter(e => e.text.trim()).map(e => `[${e.doc} p.${e.page}]\n${e.text}`).join("\n\n---\n\n");
  return `You have access to the user's documents below. Answer using them when relevant. After each fact taken from them, cite it like [filename p.N]. If the documents do not contain the answer, say so plainly, then answer from general knowledge if you can.\n\n=== DOCUMENTS ===\n${body}\n=== END DOCUMENTS ===`;
}
