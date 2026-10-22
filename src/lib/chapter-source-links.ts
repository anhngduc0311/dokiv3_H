import { sql } from './db';

let schema: Promise<unknown> | undefined;
async function ensureLinks() {
  schema ??= sql`CREATE TABLE IF NOT EXISTS "MangaChapterSources" (
    "MangaId" uuid PRIMARY KEY, "TruyenGgId" uuid NOT NULL, "MatchedTitle" text NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`.catch(error => { schema = undefined; throw error; });
  await schema;
}
export async function findChapterSourceLink(mangaId: string): Promise<string | null> {
  await ensureLinks();
  const rows = await sql`SELECT "TruyenGgId" FROM "MangaChapterSources" WHERE "MangaId" = ${mangaId} LIMIT 1`;
  return rows[0]?.TruyenGgId || null;
}
export async function saveChapterSourceLink(mangaId: string, sourceId: string, title: string) {
  await ensureLinks();
  await sql`INSERT INTO "MangaChapterSources" ("MangaId", "TruyenGgId", "MatchedTitle")
    VALUES (${mangaId}, ${sourceId}, ${title})
    ON CONFLICT ("MangaId") DO NOTHING`;
}
