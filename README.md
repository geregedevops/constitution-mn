# Үндсэн Хууль AI

Монгол Улсын Үндсэн хуулийн AI чатбот. RAG (Retrieval-Augmented Generation) технологид суурилсан, Үндсэн хуулийн бүх зүйл, заалтаас хариулт өгнө.

**Нэг команд** ажиллуулахад бэлэн — контент, embedding бүгд урьдчилж бэлдэгдсэн.

## Онцлог

- Үндсэн хуулийн бүх зүйл, заалтаас AI хариулт
- Монгол хэлээр асууж, Монгол хэлээр хариулна
- Хуулийн зүйл, заалтыг нарийвчлан дурдаж хариулна
- Хайлтын технологи: vector + full-text hybrid search
- LLM reranking + MMR diversity
- Query rewriting — богино асуултыг тодорхой болгоно
- Agentic RAG — нэмэлт хайлт шаардлагатай үед AI өөрөө хайна

## Хурдан эхлэх

### Шаардлага

- [Docker](https://docs.docker.com/get-docker/) суулгасан байх
- [Google AI Studio](https://aistudio.google.com/apikey) — **Gemini API key** авах (үнэгүй)

### Ажиллуулах

```bash
# 1. Repo clone хийх
git clone https://github.com/geregedevops/constitution-mn.git
cd constitution-mn

# 2. API key тохируулах
cp .env.example .env
# .env файлд GEMINI_API_KEY= утгаа бичнэ

# 3. Ажиллуулах
docker compose up -d

# 4. Нээх
# http://localhost:3000
```

Анхны удаа эхлэхэд PostgreSQL database автоматаар үүсч, бүх контент + embedding-ууд ачаалагдана. ~1-2 минут хүлээнэ.

### Зогсоох

```bash
docker compose down
```

## Архитектур

```
┌─────────────────────────────────────────────────────┐
│  Browser (http://localhost:3000)                     │
│  ┌───────────┐ ┌─────────────────────────────────┐  │
│  │  Sidebar   │ │  Chat Interface                 │  │
│  │  - Гарчиг  │ │  - Асуулт бичих                │  │
│  │  - Санал   │ │  - AI хариулт (markdown)       │  │
│  │  - Мэдээлэл│ │  - Хуулах, Stop, Regenerate    │  │
│  └───────────┘ └─────────────────────────────────┘  │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────┐
│  Next.js API (/api/chat)                             │
│                                                      │
│  User Query                                          │
│    → Query Rewrite (Gemini, <10 words)               │
│    → Hybrid Search (vector + tsvector + RRF)         │
│    → LLM Reranking (top 15 → scored → top 5)        │
│    → MMR Diversity (lambda=0.7)                      │
│    → Context Inject → Gemini 2.5 Flash Stream       │
│    → Agentic RAG (нэмэлт хайлт шаардлагатай бол)   │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────┐
│  PostgreSQL + pgvector                               │
│  ┌──────────┐  ┌──────────────────────────────────┐  │
│  │ contents │  │ chunks (50 chunks, 768-dim embed) │  │
│  │ (1 row)  │  │ + tsvector full-text index        │  │
│  └──────────┘  │ + pg_trgm trigram index           │  │
│                │ + HNSW vector index                │  │
│                └──────────────────────────────────┘  │
└──────────────────────────────────────────────────────┘
```

## Технологи

| Компонент | Технологи |
|---|---|
| Framework | Next.js 16 (App Router, TypeScript) |
| LLM | Google Gemini 2.5 Flash |
| Embedding | Gemini Embedding 001 (768 dim) |
| Database | PostgreSQL 16 + pgvector |
| Search | Hybrid: cosine vector + tsvector + pg_trgm |
| Ranking | RRF merge → LLM reranking → MMR diversity |
| UI | shadcn/ui + Tailwind CSS 4 |
| Markdown | react-markdown |
| Font | IBM Plex Sans (Cyrillic) |

## Файлын бүтэц

```
constitution-mn/
├── data/
│   └── seed.sql              # Бэлэн data (content + chunks + embeddings)
├── src/
│   ├── app/
│   │   ├── layout.tsx         # Үндсэн layout
│   │   ├── page.tsx           # Нүүр хуудас (sidebar + chat)
│   │   ├── globals.css        # Загвар
│   │   └── api/
│   │       ├── chat/route.ts  # Chat API (RAG + streaming)
│   │       └── health/route.ts
│   ├── components/
│   │   ├── chat-interface.tsx # Chat UI component
│   │   └── ui/               # shadcn/ui
│   └── lib/
│       ├── rag.ts             # RAG pipeline (hybrid, RRF, rerank, MMR)
│       ├── embedding.ts       # Gemini embedding
│       ├── query-rewrite.ts   # Query rewriting
│       ├── prompts.ts         # System prompt
│       └── db.ts              # Prisma client
├── prisma/
│   └── schema.prisma          # DB schema (Content + Chunk)
├── docker-compose.yml         # Docker тохиргоо
├── Dockerfile                 # Multi-stage build
└── .env.example               # API key template
```

## Өөрийн контент ашиглах

Энэ project-г template болгон ашиглаж, өөр контент дээр RAG chatbot хийж болно:

1. `data/seed.sql` файлыг өөрийн контент + embedding-ээр солино
2. `src/lib/prompts.ts` — system prompt-г контентод тохируулна
3. `src/app/page.tsx` — suggested questions солино
4. `src/app/layout.tsx` — branding солино

Embedding үүсгэхдээ [Google AI Studio](https://aistudio.google.com/) ашиглана (gemini-embedding-001, 768 dim, RETRIEVAL_DOCUMENT task type).

## Холбоос

- **Data Chatbot Platform** — Энэ project-г үүсгэсэн платформ: [ai.dataslice.info](https://ai.dataslice.info)
- **Gemini API** — [Google AI Studio](https://aistudio.google.com/)
- **pgvector** — [PostgreSQL vector extension](https://github.com/pgvector/pgvector)

## Лиценз

MIT — Чөлөөтэй ашиглаж, өөрчилж, түгээж болно.
