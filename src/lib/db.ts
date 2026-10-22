import { neon, NeonQueryFunction } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

const databaseUrl =
  process.env.DATABASE_URL ||
  'postgresql://neondb_owner:npg_g6oc7HaBNsbG@ep-fragrant-lab-a1g6aad3-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

// Exported singleton neon query function
export const sql: NeonQueryFunction<false, false> = neon(databaseUrl);

let dbInitialized = false;

export async function ensureDbInitialized() {
  if (dbInitialized) return;

  try {
    // 1. Ensure tables exist
    await sql`
      CREATE TABLE IF NOT EXISTS "Users" (
        "Id" uuid NOT NULL PRIMARY KEY,
        "Email" character varying(254) NOT NULL UNIQUE,
        "Name" text NOT NULL,
        "PasswordHash" text NOT NULL DEFAULT '',
        "PasswordVersion" bigint NOT NULL DEFAULT 0,
        "Role" text NOT NULL DEFAULT 'reader',
        "Coins" bigint NOT NULL DEFAULT 0,
        "IsBanned" boolean NOT NULL DEFAULT false,
        "CreatedAt" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS "Mangas" (
        "Id" text NOT NULL PRIMARY KEY,
        "Title" character varying(500) NOT NULL,
        "AlternativeTitle" text NOT NULL DEFAULT '',
        "Author" text NOT NULL DEFAULT '',
        "Artist" text NOT NULL DEFAULT '',
        "Cover" text NOT NULL DEFAULT '',
        "Description" text NOT NULL DEFAULT '',
        "Genres" text[] NOT NULL DEFAULT '{}',
        "Tags" text[] NOT NULL DEFAULT '{}',
        "Status" text NOT NULL DEFAULT 'ongoing',
        "Country" text NOT NULL DEFAULT 'jp',
        "Demographic" text NOT NULL DEFAULT 'shounen',
        "Year" integer NOT NULL DEFAULT 2026,
        "Featured" boolean NOT NULL DEFAULT false,
        "IsDemo" boolean NOT NULL DEFAULT false,
        "IsDraft" boolean NOT NULL DEFAULT false,
        "IsHidden" boolean NOT NULL DEFAULT false,
        "ScanlationGroup" text NOT NULL DEFAULT '',
        "SourceType" text NOT NULL DEFAULT 'crawl',
        "Views" bigint NOT NULL DEFAULT 0,
        "UpdatedAt" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS "Chapters" (
        "Id" text NOT NULL PRIMARY KEY,
        "MangaId" text NOT NULL REFERENCES "Mangas"("Id") ON DELETE CASCADE,
        "Number" numeric NOT NULL DEFAULT 1,
        "Title" text NOT NULL DEFAULT '',
        "Language" text NOT NULL DEFAULT 'vi',
        "Pages" text[] NOT NULL DEFAULT '{}',
        "Content" text NULL,
        "ContentType" text NOT NULL DEFAULT 'comic',
        "IsLocked" boolean NOT NULL DEFAULT false,
        "CoinPrice" integer NOT NULL DEFAULT 0,
        "UnlockAt" timestamp with time zone NULL,
        "ScheduledPublishAt" timestamp with time zone NULL,
        "PublishedAt" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS "Follows" (
        "UserId" uuid NOT NULL REFERENCES "Users"("Id") ON DELETE CASCADE,
        "MangaId" text NOT NULL REFERENCES "Mangas"("Id") ON DELETE CASCADE,
        "CreatedAt" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY ("UserId", "MangaId")
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS "Ratings" (
        "UserId" uuid NOT NULL REFERENCES "Users"("Id") ON DELETE CASCADE,
        "MangaId" text NOT NULL REFERENCES "Mangas"("Id") ON DELETE CASCADE,
        "Score" integer NOT NULL DEFAULT 10,
        PRIMARY KEY ("UserId", "MangaId")
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS "Histories" (
        "UserId" uuid NOT NULL REFERENCES "Users"("Id") ON DELETE CASCADE,
        "MangaId" text NOT NULL REFERENCES "Mangas"("Id") ON DELETE CASCADE,
        "ChapterId" text NOT NULL REFERENCES "Chapters"("Id") ON DELETE CASCADE,
        "ReadAt" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY ("UserId", "MangaId")
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS "Comments" (
        "Id" uuid NOT NULL PRIMARY KEY,
        "UserId" uuid NOT NULL REFERENCES "Users"("Id") ON DELETE CASCADE,
        "MangaId" text NOT NULL REFERENCES "Mangas"("Id") ON DELETE CASCADE,
        "ParentId" uuid NULL REFERENCES "Comments"("Id") ON DELETE SET NULL,
        "Body" character varying(2000) NOT NULL,
        "IsFlagged" boolean NOT NULL DEFAULT false,
        "CreatedAt" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS "Notifications" (
        "Id" uuid NOT NULL PRIMARY KEY,
        "UserId" uuid NOT NULL REFERENCES "Users"("Id") ON DELETE CASCADE,
        "ActorId" uuid NULL,
        "ActorName" character varying(200) NOT NULL DEFAULT '',
        "MangaId" text NOT NULL,
        "MangaTitle" character varying(500) NOT NULL DEFAULT '',
        "CommentId" uuid NULL,
        "Type" character varying(50) NOT NULL DEFAULT 'comment_reply',
        "Message" character varying(1000) NOT NULL DEFAULT '',
        "IsRead" boolean NOT NULL DEFAULT false,
        "CreatedAt" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS "Reports" (
        "Id" uuid NOT NULL PRIMARY KEY,
        "UserId" uuid NULL REFERENCES "Users"("Id") ON DELETE SET NULL,
        "MangaId" text NULL REFERENCES "Mangas"("Id") ON DELETE SET NULL,
        "ChapterId" text NULL REFERENCES "Chapters"("Id") ON DELETE SET NULL,
        "CommentId" uuid NULL,
        "Type" text NOT NULL DEFAULT 'broken_image',
        "Reason" text NOT NULL DEFAULT '',
        "Status" text NOT NULL DEFAULT 'pending',
        "Notes" text NOT NULL DEFAULT '',
        "CreatedAt" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "ResolvedAt" timestamp with time zone NULL
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS "CoinTransactions" (
        "Id" uuid NOT NULL PRIMARY KEY,
        "UserId" uuid NOT NULL REFERENCES "Users"("Id") ON DELETE CASCADE,
        "Amount" bigint NOT NULL DEFAULT 0,
        "Type" text NOT NULL DEFAULT 'deposit',
        "Description" text NOT NULL DEFAULT '',
        "CreatedAt" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS "BannedKeywords" (
        "Id" uuid NOT NULL PRIMARY KEY,
        "Keyword" text NOT NULL UNIQUE,
        "Action" text NOT NULL DEFAULT 'block',
        "CreatedAt" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS "TaxonomyItems" (
        "Id" uuid NOT NULL PRIMARY KEY,
        "Type" text NOT NULL DEFAULT 'genre',
        "Name" text NOT NULL,
        "Slug" text NOT NULL,
        "Description" text NOT NULL DEFAULT '',
        "CreatedAt" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "UQ_Taxonomy_Type_Slug" UNIQUE ("Type", "Slug")
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS "SystemLogs" (
        "Id" uuid NOT NULL PRIMARY KEY,
        "Level" text NOT NULL DEFAULT 'info',
        "Source" text NOT NULL DEFAULT 'system',
        "Message" text NOT NULL DEFAULT '',
        "CreatedAt" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `;

    // 2. Ensure default administrator user
    const adminEmail = (process.env.ADMIN_EMAIL || 'admin@dokihentai.com').trim().toLowerCase();
    const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@DokiHentai2026!';
    const existingAdmin = await sql`
      SELECT "Id" FROM "Users" WHERE "Email" = ${adminEmail} OR "Email" = 'admin@dokitruyen.com' OR "Role" = 'admin' OR "Role" = 'superadmin' LIMIT 1;
    `;

    if (!existingAdmin || existingAdmin.length === 0) {
      const hash = await bcrypt.hash(adminPassword, 10);
      const adminId = uuidv4();
      await sql`
        INSERT INTO "Users" ("Id", "Email", "Name", "PasswordHash", "Role", "Coins", "CreatedAt")
        VALUES (${adminId}, ${adminEmail}, 'Quản trị viên', ${hash}, 'superadmin', 100000, CURRENT_TIMESTAMP)
        ON CONFLICT ("Email") DO NOTHING;
      `;
    }

    // 3. Ensure default taxonomy items
    const taxCount = await sql`SELECT count(*)::int as count FROM "TaxonomyItems"`;
    if (taxCount[0]?.count === 0) {
      const defaultGenres = [
        ['genre', 'Action', 'action', 'Truyện hành động mãn nhãn'],
        ['genre', 'Comedy', 'comedy', 'Truyện hài hước thư giãn'],
        ['genre', 'Drama', 'drama', 'Kịch tính, cao trào và nội tâm'],
        ['genre', 'Fantasy', 'fantasy', 'Thế giới huyền bí phép thuật'],
        ['genre', 'Isekai', 'isekai', 'Chuyển sinh sang dị giới'],
        ['genre', 'Manhwa', 'manhwa', 'Truyện tranh phong cách Hàn Quốc'],
        ['genre', 'Manhua', 'manhua', 'Truyện tranh phong cách Trung Quốc'],
        ['genre', 'Romance', 'romance', 'Tình cảm lãng mạn'],
        ['genre', 'Shounen', 'shounen', 'Dành cho lứa tuổi thiếu niên'],
        ['genre', 'Slice of Life', 'slice-of-life', 'Đời thường ấm áp']
      ];

      for (const [type, name, slug, desc] of defaultGenres) {
        await sql`
          INSERT INTO "TaxonomyItems" ("Id", "Type", "Name", "Slug", "Description", "CreatedAt")
          VALUES (${uuidv4()}, ${type}, ${name}, ${slug}, ${desc}, CURRENT_TIMESTAMP)
          ON CONFLICT ("Type", "Slug") DO NOTHING;
        `;
      }
    }

    dbInitialized = true;
  } catch (err) {
    console.error('[DB] ensureDbInitialized failed:', err);
  }
}
