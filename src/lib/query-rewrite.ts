const REWRITE_MODEL = "gemini-2.5-flash";
const MAX_WORDS_TO_REWRITE = 10;

/**
 * Query rewriting: short/vague queries -> RAG-friendly form.
 * Skips long queries (>10 words) as they're already specific enough.
 */
export async function rewriteQuery(
  query: string,
  contentTitle: string
): Promise<string> {
  const wordCount = query.trim().split(/\s+/).length;
  if (wordCount > MAX_WORDS_TO_REWRITE) return query;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return query;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${REWRITE_MODEL}:generateContent`,
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
                  text: `Чи RAG системд зориулж хэрэглэгчийн асуултыг дахин бичих туслах юм.

Контент: "${contentTitle}"
Хэрэглэгчийн асуулт: "${query}"

Зааварчилгаа:
- Асуултыг илүү тодорхой, RAG хайлтад тохиромжтой болгож дахин бич
- Монгол хэлээр бич
- Зөвхөн дахин бичсэн асуултыг л буцаа, өөр юу ч бичихгүй
- Хэрэв асуулт аль хэдийн тодорхой бол шууд буцаа`,
                },
              ],
            },
          ],
          generationConfig: {
            maxOutputTokens: 100,
            temperature: 0.1,
          },
        }),
        signal: AbortSignal.timeout(5000),
      }
    );

    if (!response.ok) return query;

    const data = await response.json();

    const rewritten = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    return rewritten || query;
  } catch {
    return query;
  }
}
