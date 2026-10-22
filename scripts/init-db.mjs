import { neon } from '@neondatabase/serverless';

const databaseUrl =
  process.env.DATABASE_URL ||
  'postgresql://neondb_owner:npg_g6oc7HaBNsbG@ep-fragrant-lab-a1g6aad3-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

const sql = neon(databaseUrl);

async function init() {
  console.log('Testing connection to Neon...');
  const res = await sql`SELECT 1 as val`;
  console.log('Connected:', res);

  console.log('Creating tables...');
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
      "Id" uuid NOT NULL PRIMARY KEY,
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
      "Id" uuid NOT NULL PRIMARY KEY,
      "MangaId" uuid NOT NULL REFERENCES "Mangas"("Id") ON DELETE CASCADE,
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
      "MangaId" uuid NOT NULL REFERENCES "Mangas"("Id") ON DELETE CASCADE,
      "CreatedAt" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY ("UserId", "MangaId")
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS "Ratings" (
      "UserId" uuid NOT NULL REFERENCES "Users"("Id") ON DELETE CASCADE,
      "MangaId" uuid NOT NULL REFERENCES "Mangas"("Id") ON DELETE CASCADE,
      "Score" integer NOT NULL DEFAULT 10,
      PRIMARY KEY ("UserId", "MangaId")
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS "Histories" (
      "UserId" uuid NOT NULL REFERENCES "Users"("Id") ON DELETE CASCADE,
      "MangaId" uuid NOT NULL REFERENCES "Mangas"("Id") ON DELETE CASCADE,
      "ChapterId" uuid NOT NULL REFERENCES "Chapters"("Id") ON DELETE CASCADE,
      "ReadAt" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY ("UserId", "MangaId")
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS "Comments" (
      "Id" uuid NOT NULL PRIMARY KEY,
      "UserId" uuid NOT NULL REFERENCES "Users"("Id") ON DELETE CASCADE,
      "MangaId" uuid NOT NULL REFERENCES "Mangas"("Id") ON DELETE CASCADE,
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
      "MangaId" uuid NOT NULL,
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
      "MangaId" uuid NULL REFERENCES "Mangas"("Id") ON DELETE SET NULL,
      "ChapterId" uuid NULL REFERENCES "Chapters"("Id") ON DELETE SET NULL,
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

  // Indexes
  await sql`CREATE INDEX IF NOT EXISTS "IX_Mangas_UpdatedAt" ON "Mangas"("UpdatedAt" DESC);`;
  await sql`CREATE INDEX IF NOT EXISTS "IX_Chapters_MangaId_Number" ON "Chapters"("MangaId", "Number" ASC);`;
  await sql`CREATE INDEX IF NOT EXISTS "IX_Notifications_UserId_CreatedAt" ON "Notifications"("UserId", "CreatedAt" DESC);`;
  await sql`CREATE INDEX IF NOT EXISTS "IX_Comments_MangaId_CreatedAt" ON "Comments"("MangaId", "CreatedAt" DESC);`;
  await sql`CREATE INDEX IF NOT EXISTS "IX_Histories_ReadAt" ON "Histories"("ReadAt" DESC);`;
  await sql`CREATE INDEX IF NOT EXISTS "IX_SystemLogs_CreatedAt" ON "SystemLogs"("CreatedAt" DESC);`;

  console.log('Tables and indexes verified successfully in Neon!');
}

init().catch(console.error);
