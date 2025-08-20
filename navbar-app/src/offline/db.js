// Offline IndexedDB setup using Dexie
import Dexie from 'dexie';

export const db = new Dexie('nutrition_app');
// v1 -> v2 adds localId, photoHash indexes
db.version(1).stores({
  childRecords: '&healthId, status, createdAt'
});
db.version(2).stores({
  childRecords: '&healthId, localId, status, createdAt, photoHash'
}).upgrade(tx => {
  return tx.table('childRecords').toCollection().modify(r => {
    // Ensure localId present; generate fallback
    if (!r.localId) r.localId = r.healthId + '-L';
  });
});

export async function addChildRecord(record) {
  await db.childRecords.add(record);
}

export async function updateChildRecord(healthId, changes) {
  await db.childRecords.update(healthId, changes);
}

export async function listChildRecords() {
  return db.childRecords.orderBy('createdAt').reverse().toArray();
}

export async function pendingRecords() {
  return db.childRecords.where('status').anyOf(['pending','failed']).toArray();
}

export async function uploadedRecords() {
  return db.childRecords.where('status').equals('uploaded').toArray();
}

export async function recordCounts() {
  const [pending, failed, uploaded] = await Promise.all([
    db.childRecords.where('status').anyOf(['pending','uploading']).count(),
    db.childRecords.where('status').equals('failed').count(),
    db.childRecords.where('status').equals('uploaded').count()
  ]);
  return { pending, failed, uploaded };
}

// Purge uploaded records older than retentionDays
export async function purgeOldUploaded(retentionDays = 7) {
  const cutoff = Date.now() - retentionDays*24*60*60*1000;
  const old = await db.childRecords.where('status').equals('uploaded').and(r => (r.uploadedAt || 0) < cutoff).toArray();
  if (old.length) {
    await db.childRecords.bulkDelete(old.map(r => r.healthId));
  }
  return old.length;
}
