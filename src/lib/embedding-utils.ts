const EMBEDDING_DIMENSIONS = 768;

export function validateEmbedding(embedding: number[]): number[] {
  if (!Array.isArray(embedding) || embedding.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(
      `Invalid embedding: expected ${EMBEDDING_DIMENSIONS} dimensions, got ${embedding?.length ?? 0}`
    );
  }
  if (!embedding.every((x) => typeof x === "number" && isFinite(x))) {
    throw new Error("Invalid embedding: contains non-numeric values");
  }
  return embedding;
}
