import crypto from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { closeDb, query, withClient } from "../src/services/db.js";

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const migrationsDir = join(rootDir, "migrations");
const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const listOnly = args.has("--list");

try {
  await ensureMigrationsTable();
  const migrations = await readMigrations();
  const applied = await readAppliedMigrations();
  const pending = [];

  for (const migration of migrations) {
    const appliedMigration = applied.get(migration.version);
    if (appliedMigration) {
      if (appliedMigration.checksum !== migration.checksum) {
        throw new Error(`Migration checksum mismatch: ${migration.version}`);
      }
      continue;
    }
    pending.push(migration);
  }

  if (listOnly || dryRun) {
    console.log(JSON.stringify({
      ok: true,
      dryRun,
      applied: migrations.length - pending.length,
      pending: pending.map((migration) => migration.version)
    }, null, 2));
  } else {
    for (const migration of pending) {
      await applyMigration(migration);
      console.log(JSON.stringify({
        ok: true,
        migrated: migration.version
      }));
    }

    console.log(JSON.stringify({
      ok: true,
      applied: pending.length,
      total: migrations.length
    }, null, 2));
  }
} finally {
  await closeDb();
}

async function ensureMigrationsTable() {
  await query(`
    create table if not exists schema_migrations (
      version text primary key,
      checksum text not null,
      applied_at timestamptz not null default now()
    )
  `);
}

async function readMigrations() {
  const entries = await readdir(migrationsDir, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
    .map((entry) => entry.name)
    .sort();

  const migrations = [];
  for (const file of files) {
    const sql = await readFile(join(migrationsDir, file), "utf8");
    migrations.push({
      version: file.replace(/\.sql$/i, ""),
      file,
      sql,
      checksum: crypto.createHash("sha256").update(sql).digest("hex"),
      useTransaction: !/^\s*--\s*migrate:\s*no-transaction\s*$/im.test(sql)
    });
  }
  return migrations;
}

async function readAppliedMigrations() {
  const result = await query(`
    select version, checksum
    from schema_migrations
  `);
  return new Map(result.rows.map((row) => [row.version, row]));
}

async function applyMigration(migration) {
  if (!migration.useTransaction) {
    await query(migration.sql);
    await query(`
      insert into schema_migrations (version, checksum)
      values ($1, $2)
    `, [migration.version, migration.checksum]);
    return;
  }

  await withClient(async (client) => {
    await client.query("begin");
    try {
      await client.query(migration.sql);
      await client.query(`
        insert into schema_migrations (version, checksum)
        values ($1, $2)
      `, [migration.version, migration.checksum]);
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
  });
}
