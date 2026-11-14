#!/usr/bin/env bash
# Fails when the database schema was changed without a generated migration (spec 017, FR-005).
#
# How it works: fingerprint the migrations folder, ask the generator for any missing migration,
# fingerprint again. If the folder changed, a migration was missing.
#
#   schema.ts edited, no migration  -->  generator writes 0004_xxx.sql  -->  fingerprint differs  -->  FAIL
#   schema.ts unchanged             -->  "No schema changes"            -->  fingerprint same     -->  OK
#
# Usage: bash scripts/ci/check-migrations.sh      (also: pnpm check:migrations)
set -euo pipefail

MIGRATIONS_DIRECTORY="apps/desktop/drizzle"
# Overridable so the failure path can be tested without editing the real schema.
GENERATE_COMMAND="${MIGRATION_GENERATE_COMMAND:-pnpm --filter @shopos/desktop db:generate}"

fingerprint_migrations() {
  # git hash-object is available wherever git is; sort makes the result independent of file order.
  find "$MIGRATIONS_DIRECTORY" -type f -exec git hash-object {} + | sort | git hash-object --stdin
}

fingerprint_before=$(fingerprint_migrations)

# stdin from /dev/null so a rename prompt can never hang a CI run; it fails instead.
bash -c "$GENERATE_COMMAND" < /dev/null > /dev/null

fingerprint_after=$(fingerprint_migrations)

if [ "$fingerprint_before" != "$fingerprint_after" ]; then
  echo "Migrations are out of date: the schema changed without a generated migration." >&2
  echo "Run: pnpm --filter @shopos/desktop db:generate" >&2
  echo "Then read the generated SQL, re-create any triggers on a rebuilt table, and commit the files." >&2
  git status --short "$MIGRATIONS_DIRECTORY" >&2
  exit 1
fi

echo "Migrations are in sync with the schema."
