import { NextResponse } from 'next/server';
import { sql, ensureDbInitialized } from '@/lib/db';
import { redis } from '@/lib/redis';

export async function GET() {
  let dbOk = false;
  try {
    await ensureDbInitialized();
    const res = await sql`SELECT 1 as val`;
    dbOk = res && res.length > 0;
  } catch {}

  let redisOk = false;
  if (redis) {
    try {
      const pong = await redis.ping();
      redisOk = pong === 'PONG';
    } catch {}
  }

  return NextResponse.json({
    status: dbOk ? 'healthy' : 'degraded',
    database: dbOk ? 'connected' : 'disconnected',
    redis: redisOk ? 'connected' : 'disabled/unreachable',
    platform: 'Next.js Serverless (Vercel)',
    timestamp: new Date().toISOString()
  });
}
