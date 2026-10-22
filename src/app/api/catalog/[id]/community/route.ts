import { NextResponse } from 'next/server';
import { sql, ensureDbInitialized } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await ensureDbInitialized();
  const user = await getUserFromRequest(req);

  const stats = await sql`
    SELECT coalesce(avg("Score")::float, 0) as rating, count(*)::int as votes
    FROM "Ratings"
    WHERE "MangaId" = ${id};
  `;

  let myRating = 0;
  if (user) {
    const mine = await sql`
      SELECT "Score" FROM "Ratings" WHERE "MangaId" = ${id} AND "UserId" = ${user.id} LIMIT 1;
    `;
    if (mine && mine.length > 0) {
      myRating = Number(mine[0].Score || 0);
    }
  }

  return NextResponse.json({
    rating: stats[0]?.rating || 0,
    votes: stats[0]?.votes || 0,
    myRating
  });
}
