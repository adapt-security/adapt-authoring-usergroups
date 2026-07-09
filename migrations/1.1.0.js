/**
 * Backfills the additive `_access.groups` grant from the legacy `userGroups` field on
 * shareable resources (courses and assets), preserving existing sharing semantics.
 * Legacy `userGroups` is left in place until the contract step (adaptframework#224).
 * Idempotent: only touches documents that still carry `userGroups` and have no
 * `_access.groups` yet.
 */
export default function (migration) {
  migration.describe('Backfill _access.groups from legacy userGroups on courses and assets')
  migration.runCommand(db => backfill(db, 'content'))
  migration.runCommand(db => backfill(db, 'assets'))
}

async function backfill (db, collectionName) {
  return db.collection(collectionName).updateMany(
    {
      userGroups: { $exists: true, $not: { $size: 0 } },
      '_access.groups': { $exists: false }
    },
    [{ $set: { '_access.groups': '$userGroups' } }]
  )
}
