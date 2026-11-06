// D1 reports live storage after automatic page reclamation (verified on D1).
// Leave 50 MB below the Free database's 500 MB ceiling for writes and indexes.
export const STORAGE_SOFT_LIMIT_BYTES = 450_000_000;
export async function pruneOldestIfNeeded(db, limit = STORAGE_SOFT_LIMIT_BYTES) {
  let state = await db.prepare('SELECT 1').run();
  let deleted = 0;
  if (!Number.isFinite(state.meta?.size_after)) throw new Error('Missing D1 storage metadata');
  // Small bounded batches avoid full-table scans and large write bursts.
  for (let batch = 0; state.meta.size_after >= limit && batch < 10; batch++) {
    state = await db.prepare('DELETE FROM messages WHERE id IN (SELECT id FROM messages ORDER BY id ASC LIMIT 100)').run();
    const changes = state.meta.changes;
    deleted += changes;
    if (!changes) break;
  }
  if (state.meta.size_after >= limit) {
    const error = new Error('A tárhely felszabadítása folyamatban van. Próbáld meg újra az üzenetküldést.');
    error.status = 503;
    throw error;
  }
  return deleted;
}
