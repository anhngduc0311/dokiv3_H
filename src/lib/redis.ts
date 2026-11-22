import Redis from 'ioredis';

const memoryStore = new Map<string, { value: any; expiry: number }>();

let redisClient: Redis | null = null;

const redisUrl = process.env.REDIS_URL;

if (redisUrl) {
  try {
    redisClient = new Redis(redisUrl, { maxRetriesPerRequest: 2, enableReadyCheck: true });
  } catch (err) {
    console.warn('[REDIS] Failed to initialize Redis client, using in-memory fallback:', err);
  }
}

export const redis = redisClient;

export async function cacheGet<T = any>(key: string): Promise<T | null> {
  if (redisClient) {
    try {
      const raw = await redisClient.get(key);
      const data = raw === null ? null : JSON.parse(raw) as T;
      if (data !== null && data !== undefined) return data;
    } catch (e) {
      // Fallback to memory on network hiccup
    }
  }

  const mem = memoryStore.get(key);
  if (mem) {
    if (Date.now() < mem.expiry) return mem.value as T;
    memoryStore.delete(key);
  }
  return null;
}

export async function cacheSet(key: string, value: any, ttlSeconds: number = 300): Promise<void> {
  if (redisClient) {
    try {
      await redisClient.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch (e) {
      // Ignore Upstash set errors and set memory
    }
  }

  memoryStore.set(key, {
    value,
    expiry: Date.now() + ttlSeconds * 1000
  });
}

export async function cacheDelete(key: string): Promise<void> {
  if (redisClient) {
    try {
      await redisClient.del(key);
    } catch {}
  }
  memoryStore.delete(key);
}
