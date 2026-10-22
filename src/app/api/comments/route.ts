import { NextResponse } from 'next/server';
import { sql, ensureDbInitialized } from '@/lib/db';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mangaId = searchParams.get('mangaId');
  const page = parseInt(searchParams.get('page') || '1', 10);
  const pageSize = 20;
  const offset = (page - 1) * pageSize;

  await ensureDbInitialized();

  let rows;
  let totalRows;

  if (mangaId) {
    rows = await sql`
      SELECT c."Id", c."MangaId", m."Title" as "mangaTitle", c."UserId", u."Name" as "name",
             c."ParentId", p_u."Name" as "replyToName", c."Body", c."CreatedAt"
      FROM "Comments" c
      JOIN "Mangas" m ON m."Id" = c."MangaId"
      JOIN "Users" u ON u."Id" = c."UserId"
      LEFT JOIN "Comments" p ON p."Id" = c."ParentId"
      LEFT JOIN "Users" p_u ON p_u."Id" = p."UserId"
      WHERE c."MangaId" = ${mangaId} AND c."IsFlagged" = false
      ORDER BY c."CreatedAt" DESC
      LIMIT ${pageSize} OFFSET ${offset};
    `;

    totalRows = await sql`
      SELECT count(*)::int as total FROM "Comments" WHERE "MangaId" = ${mangaId} AND "IsFlagged" = false;
    `;
  } else {
    rows = await sql`
      SELECT c."Id", c."MangaId", m."Title" as "mangaTitle", c."UserId", u."Name" as "name",
             c."ParentId", p_u."Name" as "replyToName", c."Body", c."CreatedAt"
      FROM "Comments" c
      JOIN "Mangas" m ON m."Id" = c."MangaId"
      JOIN "Users" u ON u."Id" = c."UserId"
      LEFT JOIN "Comments" p ON p."Id" = c."ParentId"
      LEFT JOIN "Users" p_u ON p_u."Id" = p."UserId"
      WHERE c."IsFlagged" = false
      ORDER BY c."CreatedAt" DESC
      LIMIT ${pageSize} OFFSET ${offset};
    `;

    totalRows = await sql`
      SELECT count(*)::int as total FROM "Comments" WHERE "IsFlagged" = false;
    `;
  }

  const items = rows.map((r: any) => ({
    id: r.Id,
    mangaId: r.MangaId,
    mangaTitle: r.mangaTitle,
    userId: r.UserId,
    name: r.name,
    parentId: r.ParentId,
    replyToName: r.replyToName,
    body: r.Body,
    createdAt: r.CreatedAt ? new Date(r.CreatedAt).toISOString() : new Date().toISOString()
  }));

  return NextResponse.json({
    items,
    total: totalRows[0]?.total || 0,
    page,
    pageSize
  });
}
