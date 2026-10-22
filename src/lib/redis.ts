import { Redis } from '@upstash/redis';

const memoryStore = new Map<string, { value: any; expiry: number }>();

let redisClient: Redis | null = null;

const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;

if (upstashUrl && upstashToken) {
  try {
    redisClient = new Redis({
      url: upstashUrl,
      token: upstashToken
    });
  } catch (err) {
    console.warn('[REDIS] Failed to initialize Upstash client, using in-memory fallback:', err);
  }
}

export const redis = redisClient;

export async function cacheGet<T = any>(key: string): Promise<T | null> {
  if (redisClient) {
    try {
      const data = await redisClient.get<T>(key);
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
      await redisClient.set(key, value, { ex: ttlSeconds });
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
