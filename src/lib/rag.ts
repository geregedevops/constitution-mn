import { db } from "@/lib/db";
import { embedQuery } from "@/lib/embedding";
import { validateEmbedding } from "@/lib/embedding-utils";

const SIMILARITY_THRESHOLD = 0.3;
const RRF_K = 60; // standard RRF constant
const MMR_LAMBDA = 0.7; // 0=max diversity, 1=max relevance

export interface SearchResult {
  id: string;
  content: string;
  chunkIndex: number;
  similarity: number;
  metadata: Record<string, unknown>;
}

// ===== Vector Search =====

async function vectorSearch(
  contentId: string,
  queryEmbedding: number[],
  topK: number
): Promise<SearchResult[]> {
  const vectorStr = `[${queryEmbedding.join(",")}]`;

  return db.$queryRaw<SearchResult[]>`
    SELECT id, content, "chunkIndex", metadata,
           1 - (embedding <=> ${vectorStr}::vector) AS similarity
    FROM chunks
    WHERE "contentId" = ${contentId}
      AND embedding IS NOT NULL
    ORDER BY embedding <=> ${vectorStr}::vector
    LIMIT ${topK}`;
}

// ===== Full-Text Search =====

async function textSearch(
  contentId: string,
  query: string,
  topK: number
): Promise<SearchResult[]> {
  // Build tsquery: split words, join with &
  const words = query
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .split(/\s+/)
    .filter((w) => w.length > 1);

  if (words.length === 0) return [];

  const tsQuery = words.join(" & ");

  return db.$queryRaw<SearchResult[]>`
    SELECT id, content, "chunkIndex", metadata,
           ts_rank(tsv, to_tsquery('simple', ${tsQuery})) AS similarity
    FROM chunks
    WHERE "contentId" = ${contentId}
      AND tsv @@ to_tsquery('simple', ${tsQuery})
    ORDER BY ts_rank(tsv, to_tsquery('simple', ${tsQuery})) DESC
    LIMIT ${topK}`;
}

// ===== RRF Merge =====

function rrfMerge(
  vectorResults: SearchResult[],
  textResults: SearchResult[],
  topK: number
): SearchResult[] {
  const scoreMap = new Map<string, { result: SearchResult; score: number }>();

  // Assign RRF scores from vector search
  vectorResults.forEach((r, rank) => {
    const rrfScore = 1 / (RRF_K + rank + 1);
    scoreMap.set(r.id, { result: r, score: rrfScore });
  });

  // Add RRF scores from text search
  textResults.forEach((r, rank) => {
    const rrfScore = 1 / (RRF_K + rank + 1);
    const existing = scoreMap.get(r.id);
    if (existing) {
      existing.score += rrfScore;
    } else {
      scoreMap.set(r.id, { result: r, score: rrfScore });
    }
  });

  return Array.from(scoreMap.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map((entry) => entry.result);
}

// ===== MMR (Maximal Marginal Relevance) =====

function cosineSimilarity(a: string, b: string): number {
  // Simple word-overlap similarity for MMR diversity
  const wordsA = new Set(a.toLowerCase().split(/\s+/));
  const wordsB = new Set(b.toLowerCase().split(/\s+/));
  const intersection = [...wordsA].filter((w) => wordsB.has(w)).length;
  return intersection / Math.max(wordsA.size, wordsB.size, 1);
}

function applyMMR(
  results: SearchResult[],
  topK: number,
  lambda: number = MMR_LAMBDA
): SearchResult[] {
  if (results.length <= topK) return results;

  const selected: SearchResult[] = [results[0]];
  const remaining = results.slice(1);

  while (selected.length < topK && remaining.length > 0) {
    let bestIdx = 0;
    let bestScore = -Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const candidate = remaining[i];
      const relevance = candidate.similarity;

      // Max similarity to already selected
      const maxSimToSelected = Math.max(
        ...selected.map((s) => cosineSimilarity(candidate.content, s.content))
      );

      const mmrScore = lambda * relevance - (1 - lambda) * maxSimToSelected;
      if (mmrScore > bestScore) {
        bestScore = mmrScore;
        bestIdx = i;
      }
    }

    selected.push(remaining[bestIdx]);
    remaining.splice(bestIdx, 1);
  }

  return selected;
}

// ===== LLM Reranking =====

async function rerankWithLLM(
  query: string,
  chunks: SearchResult[],
  topK: number
): Promise<SearchResult[]> {
  if (chunks.length <= topK) return chunks;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return chunks.slice(0, topK);

  try {
    const chunkTexts = chunks
      .map((c, i) => `[${i}] ${c.content.slice(0, 300)}`)
      .join("\n\n");

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `Асуулт: "${query}"

Доорх текст хэсгүүдийг асуултад хамааралтай байдлаар 0-1 оноогоор үнэлнэ үү.
Зөвхөн JSON array буцаана: [{"i":0,"s":0.9},{"i":1,"s":0.2},...] — i=index, s=score.

${chunkTexts}`,
                },
              ],
            },
          ],
          generationConfig: {
            maxOutputTokens: 200,
            temperature: 0,
            responseMimeType: "application/json",
          },
        }),
        signal: AbortSignal.timeout(8000),
      }
    );

    if (!response.ok) return chunks.slice(0, topK);

    const data = await response.json();

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!text) return chunks.slice(0, topK);

    const scores: { i: number; s: number }[] = JSON.parse(text);
    const scored = scores
      .filter((s) => s.i >= 0 && s.i < chunks.length)
      .sort((a, b) => b.s - a.s)
      .slice(0, topK);

    return scored.map((s) => ({
      ...chunks[s.i],
      similarity: s.s,
    }));
  } catch {
    return chunks.slice(0, topK);
  }
}

// ===== Context Deduplication =====

function deduplicateChunks(chunks: SearchResult[]): SearchResult[] {
  if (chunks.length <= 1) return chunks;

  const sorted = [...chunks].sort((a, b) => a.chunkIndex - b.chunkIndex);
  const result: SearchResult[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];

    if (curr.chunkIndex !== prev.chunkIndex + 1) {
      result.push(curr);
      continue;
    }

    const prevText = prev.content;
    const currText = curr.content;
    const maxOverlap = Math.min(prevText.length, currText.length, 300);
    let overlapLen = 0;

    for (let len = 20; len <= maxOverlap; len++) {
      if (currText.startsWith(prevText.slice(-len))) {
        overlapLen = len;
      }
    }

    if (overlapLen > 0) {
      result.push({ ...curr, content: currText.slice(overlapLen).trim() });
    } else {
      result.push(curr);
    }
  }

  return result;
}

// ===== Main Search Pipeline =====

export async function searchSimilarChunks(
  contentId: string,
  query: string,
  topK: number = 5
): Promise<SearchResult[]> {
  const queryEmbedding = validateEmbedding(await embedQuery(query));

  // 1. Hybrid search: vector + text
  const [vecResults, txtResults] = await Promise.all([
    vectorSearch(contentId, queryEmbedding, 15),
    textSearch(contentId, query, 10),
  ]);

  // 2. RRF merge
  const merged = rrfMerge(vecResults, txtResults, 15);

  // 3. Filter by threshold
  const filtered = merged.filter((r) => r.similarity >= SIMILARITY_THRESHOLD);

  if (filtered.length === 0) return [];

  // 4. LLM reranking (top 15 -> scored)
  const reranked = await rerankWithLLM(query, filtered, topK + 2);

  // 5. MMR for diversity
  const diverse = applyMMR(reranked, topK);

  // 6. Sort by chunkIndex for natural reading order
  return diverse.sort((a, b) => a.chunkIndex - b.chunkIndex);
}

export function buildContext(chunks: SearchResult[]): string {
  const deduped = deduplicateChunks(chunks);

  return deduped
    .map(
      (chunk, i) =>
        `[Хэсэг ${i + 1}] (chunk #${chunk.chunkIndex})\n${chunk.content}`
    )
    .join("\n\n---\n\n");
}
