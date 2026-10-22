import { NextResponse } from 'next/server';
import { sql, ensureDbInitialized } from '@/lib/db';
import { getUserFromRequest, requireAdmin } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureDbInitialized();
    const user = await getUserFromRequest(req);
    if (!user || !requireAdmin(user)) {
      return NextResponse.json({ message: 'Không có quyền điều chỉnh xu.' }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    const amount = Number(body.amount || body.Amount) || 0;
    const description = (body.description || body.Description || 'Admin điều chỉnh số dư xu').trim();

    const existing = await sql`
      SELECT "Id", "Coins" FROM "Users" WHERE "Id" = ${id} LIMIT 1;
    `;

    if (!existing || existing.length === 0) {
      return NextResponse.json({ message: 'Không tìm thấy người dùng.' }, { status: 404 });
    }

    const currentCoins = Number(existing[0].Coins || 0);
    const newCoins = Math.max(0, currentCoins + amount);

    await sql`
      UPDATE "Users" SET "Coins" = ${newCoins} WHERE "Id" = ${id};
    `;

    const txId = uuidv4();
    const txType = amount >= 0 ? 'deposit' : 'admin_adjust';
    const now = new Date().toISOString();

    await sql`
      INSERT INTO "CoinTransactions" ("Id", "UserId", "Amount", "Type", "Description", "CreatedAt")
      VALUES (${txId}, ${id}, ${amount}, ${txType}, ${description}, ${now});
    `;

    return NextResponse.json({ coins: newCoins, transactionId: txId });
  } catch (err: any) {
    return NextResponse.json({ message: err.message || 'Lỗi điều chỉnh xu.' }, { status: 500 });
  }
}
