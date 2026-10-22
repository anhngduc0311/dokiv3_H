import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'tag';
}

async function syncGenres() {
  console.log('1. Altering TaxonomyItems.Id to text...');
  await sql`ALTER TABLE "TaxonomyItems" ALTER COLUMN "Id" TYPE text USING "Id"::text;`;

  console.log('2. Fetching genres from MimiHentai...');
  const res = await fetch('https://mimihentai.moe/api/genres');
  const mimiGenres = await res.json();
  console.log(`Fetched ${mimiGenres.length} genres from MimiHentai.`);

  console.log('3. Deleting old genres from TaxonomyItems...');
  await sql`DELETE FROM "TaxonomyItems" WHERE "Type" = 'genre'`;

  console.log('4. Inserting MimiHentai genres into TaxonomyItems...');
  let inserted = 0;
  for (const g of mimiGenres) {
    if (!g.name) continue;
    const id = String(g.id);
    const name = g.name.trim();
    const slug = slugify(name) + '-' + id; // ensure unique slug
    const desc = g.description || '';

    await sql`
      INSERT INTO "TaxonomyItems" ("Id", "Type", "Name", "Slug", "Description", "CreatedAt")
      VALUES (${id}, 'genre', ${name}, ${slug}, ${desc}, CURRENT_TIMESTAMP)
      ON CONFLICT ("Id") DO UPDATE SET "Name" = EXCLUDED."Name", "Description" = EXCLUDED."Description";
    `;
    inserted++;
  }

  console.log(`Successfully synced ${inserted} genres into TaxonomyItems!`);

  const count = await sql`SELECT count(*)::int as c FROM "TaxonomyItems" WHERE "Type" = 'genre'`;
  console.log('Current genre count in DB:', count[0].c);

  const sample = await sql`SELECT "Id", "Name", "Description" FROM "TaxonomyItems" WHERE "Type" = 'genre' LIMIT 10`;
  console.log('Sample in DB:', sample);
}

syncGenres().catch(console.error);
