import { sql } from './db';
import { ggPath } from './truyengg-parser';
import type { GgReference } from './truyengg-parser';

let schema: Promise<unknown> | undefined;
const references = new Map<string, GgReference>();
async function ensureReferences() {
  schema ??= sql`
    CREATE TABLE IF NOT EXISTS "CatalogSourceRefs" (
      "Id" uuid PRIMARY KEY, "Source" text NOT NULL, "Kind" text NOT NULL,
      "Path" text NOT NULL, "MangaId" uuid NOT NULL
    );
  `.catch(error => { schema = undefined; throw error; });
  await schema;
}
export async function saveGgReferences(refs: GgReference[]) {
  const unique = [...new Map(refs.map(r => [r.id, r])).values()];
  const fresh = unique.filter(r => !references.has(r.id));
  if (!fresh.length) return;
  await ensureReferences();
  await sql`
    INSERT INTO "CatalogSourceRefs" ("Id", "Source", "Kind", "Path", "MangaId")
    SELECT x.id::uuid, 'truyengg', x.kind, x.path, x."mangaId"::uuid
    FROM jsonb_to_recordset(${JSON.stringify(fresh)}::jsonb) AS x(id text, kind text, path text, "mangaId" text)
    ON CONFLICT ("Id") DO UPDATE SET "Path" = EXCLUDED."Path", "MangaId" = EXCLUDED."MangaId";
  `;
  if (references.size > 20000) references.clear();
  unique.forEach(ref => references.set(ref.id, ref));
}
export async function findGgReference(id: string, kind: GgReference['kind']): Promise<GgReference | null> {
  if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)) return null;
  const hit = references.get(id); if (hit) return hit.kind === kind ? hit : null;
  try {
    await ensureReferences();
    const rows = await sql`SELECT * FROM "CatalogSourceRefs" WHERE "Id" = ${id} AND "Source" = 'truyengg' AND "Kind" = ${kind} LIMIT 1`;
    const row = rows[0]; if (!row || !ggPath(row.Path, kind)) return null;
    const ref: GgReference = { id, kind, path: row.Path, mangaId: row.MangaId };
    references.set(id, ref); return ref;
  } catch { return null; }
}
