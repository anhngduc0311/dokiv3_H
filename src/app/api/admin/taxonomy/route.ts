import { NextResponse } from 'next/server';
import { sql, ensureDbInitialized } from '@/lib/db';
import { getUserFromRequest, requireAdmin } from '@/lib/auth';
import { getTags } from '@/lib/catalog-service';
import { v4 as uuidv4 } from 'uuid';

export async function GET(req: Request) {
  try {
    await ensureDbInitialized();
    const user = await getUserFromRequest(req);
    if (!user || !requireAdmin(user)) {
      return NextResponse.json({ message: 'Không có quyền truy cập.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const type = (searchParams.get('type') || '').trim();

    if (type === 'genre' && searchParams.get('catalog') === 'public') {
      const genres = await getTags();
      const collator = new Intl.Collator('vi', { sensitivity: 'base' });
      return NextResponse.json(genres
        .map(genre => ({ ...genre, type: 'genre', readOnly: true }))
        .sort((a, b) => collator.compare(a.name, b.name)));
    }

    let rows: any[];
    if (type) {
      rows = await sql`
        SELECT "Id" as id, "Type" as type, "Name" as name, "Slug" as slug,
               "Description" as description, "CreatedAt" as "createdAt"
        FROM "TaxonomyItems"
        WHERE "Type" = ${type}
        ORDER BY "Name" ASC;
      `;
    } else {
      rows = await sql`
        SELECT "Id" as id, "Type" as type, "Name" as name, "Slug" as slug,
               "Description" as description, "CreatedAt" as "createdAt"
        FROM "TaxonomyItems"
        ORDER BY "Name" ASC;
      `;
    }

    return NextResponse.json(rows);
  } catch (err: any) {
    return NextResponse.json({ message: err.message || 'Lỗi tải taxonomy.' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await ensureDbInitialized();
    const user = await getUserFromRequest(req);
    if (!user || !requireAdmin(user)) {
      return NextResponse.json({ message: 'Không có quyền truy cập.' }, { status: 403 });
    }

    const body = await req.json();
    const name = (body.name || body.Name || '').trim();
    const type = (body.type || body.Type || '').trim().toLowerCase();

    if (!name || !type) {
      return NextResponse.json({ message: 'Tên và loại taxonomy là bắt buộc.' }, { status: 400 });
    }

    const slug = (body.slug || body.Slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')).trim();
    const description = (body.description || body.Description || '').trim();

    const existing = await sql`
      SELECT "Id" FROM "TaxonomyItems" WHERE "Type" = ${type} AND "Slug" = ${slug} LIMIT 1;
    `;
    if (existing && existing.length > 0) {
      return NextResponse.json({ message: 'Mục này đã tồn tại.' }, { status: 409 });
    }

    const id = uuidv4();
    const now = new Date().toISOString();
    await sql`
      INSERT INTO "TaxonomyItems" ("Id", "Type", "Name", "Slug", "Description", "CreatedAt")
      VALUES (${id}, ${type}, ${name}, ${slug}, ${description}, ${now});
    `;

    return NextResponse.json(
      { id, type, name, slug, description, createdAt: now },
      { status: 201 }
    );
  } catch (err: any) {
    return NextResponse.json({ message: err.message || 'Lỗi tạo taxonomy.' }, { status: 500 });
  }
}
