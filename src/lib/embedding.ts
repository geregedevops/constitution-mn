const EMBEDDING_MODEL = "gemini-embedding-001";
const EMBEDDING_DIMENSIONS = 768;
const BATCH_SIZE = 100;
const FETCH_TIMEOUT_MS = 30_000;

interface UsageMetadata {
  promptTokenCount?: number;
  totalTokenCount?: number;
}

interface EmbeddingResponse {
  embedding: { values: number[] };
  usageMetadata?: UsageMetadata;
}

interface BatchEmbeddingResponse {
  embeddings: { values: number[] }[];
  usageMetadata?: UsageMetadata;
}

async function getApiKey(): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY environment variable is not set");
  return key;
}

function createAbortSignal(): AbortSignal {
  return AbortSignal.timeout(FETCH_TIMEOUT_MS);
}

export async function embedSingle(
  text: string,
  taskType: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY"
): Promise<number[]> {
  const apiKey = await getApiKey();

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        model: `models/${EMBEDDING_MODEL}`,
        content: { parts: [{ text }] },
        taskType,
        outputDimensionality: EMBEDDING_DIMENSIONS,
      }),
      signal: createAbortSignal(),
    }
  );

  if (!response.ok) {
    await response.text(); // consume body
    throw new Error(`Embedding service error (${response.status})`);
  }

  const data = (await response.json()) as EmbeddingResponse;

  if (!data.embedding?.values || !Array.isArray(data.embedding.values)) {
    throw new Error("Embedding service returned invalid response");
  }

  return data.embedding.values;
}

export async function embedBatch(
  texts: string[],
  taskType: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY"
): Promise<number[][]> {
  const apiKey = await getApiKey();
  const allEmbeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:batchEmbedContents`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          requests: batch.map((text) => ({
            model: `models/${EMBEDDING_MODEL}`,
            content: { parts: [{ text }] },
            taskType,
            outputDimensionality: EMBEDDING_DIMENSIONS,
          })),
        }),
        signal: createAbortSignal(),
      }
    );

    if (!response.ok) {
      await response.text(); // consume body
      throw new Error(`Embedding service error (${response.status})`);
    }

    const data = (await response.json()) as BatchEmbeddingResponse;

    if (!Array.isArray(data.embeddings)) {
      throw new Error("Embedding service returned invalid response");
    }
    if (data.embeddings.length !== batch.length) {
      throw new Error("Embedding service returned mismatched count");
    }

    allEmbeddings.push(...data.embeddings.map((e) => e.values));
  }

  return allEmbeddings;
}

export async function embedQuery(text: string): Promise<number[]> {
  return embedSingle(text, "RETRIEVAL_QUERY");
}

export async function embedDocument(text: string): Promise<number[]> {
  return embedSingle(text, "RETRIEVAL_DOCUMENT");
}
