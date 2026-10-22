import { NextResponse } from 'next/server';
import { sql, ensureDbInitialized } from '@/lib/db';
import { getUserFromRequest, requireAdmin } from '@/lib/auth';

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureDbInitialized();
    const user = await getUserFromRequest(req);
    if (!user || !requireAdmin(user)) {
      return NextResponse.json({ message: 'Không có quyền truy cập.' }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();

    const existing = await sql`
      SELECT "Id", "Type", "Name", "Slug", "Description", "CreatedAt"
      FROM "TaxonomyItems"
      WHERE "Id" = ${id}
      LIMIT 1;
    `;

    if (!existing || existing.length === 0) {
      return NextResponse.json({ message: 'Không tìm thấy mục.' }, { status: 404 });
    }

    const cur = existing[0];
    const name = body.name !== undefined ? body.name.trim() : cur.Name;
    const slug = body.slug !== undefined ? body.slug.trim().toLowerCase() : cur.Slug;
    const description = body.description !== undefined ? body.description.trim() : cur.Description;

    await sql`
      UPDATE "TaxonomyItems"
      SET "Name" = ${name},
          "Slug" = ${slug},
          "Description" = ${description}
      WHERE "Id" = ${id};
    `;

    return NextResponse.json({
      id,
      type: cur.Type,
      name,
      slug,
      description,
      createdAt: cur.CreatedAt
    });
  } catch (err: any) {
    return NextResponse.json({ message: err.message || 'Lỗi cập nhật taxonomy.' }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureDbInitialized();
    const user = await getUserFromRequest(req);
    if (!user || !requireAdmin(user)) {
      return NextResponse.json({ message: 'Không có quyền truy cập.' }, { status: 403 });
    }

    const { id } = await params;
    await sql`DELETE FROM "TaxonomyItems" WHERE "Id" = ${id};`;
    return new Response(null, { status: 204 });
  } catch (err: any) {
    return NextResponse.json({ message: err.message || 'Lỗi xóa taxonomy.' }, { status: 500 });
  }
}
