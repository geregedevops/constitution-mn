# Үндсэн Хууль AI

Монгол Улсын Үндсэн хуулийн AI чатбот. RAG технологид суурилсан.

## Хурдан эхлэх

1. `.env` файл үүсгэх: `cp .env.example .env` + GEMINI_API_KEY нэмэх
2. `docker compose up -d`
3. http://localhost:3000 нээх

## Технологи

- Next.js 16 + TypeScript
- Google Gemini 2.5 Flash
- PostgreSQL + pgvector
- RAG: hybrid search + LLM reranking + MMR

## Лиценз

MIT
