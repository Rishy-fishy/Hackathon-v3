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
  // Find records that are pending, failed, or haven't been uploaded yet
  const pendingOrFailed = await db.childRecords.where('status').anyOf(['pending','failed']).toArray();
  
  // Also find records without uploadedAt timestamp (never uploaded)
  const neverUploaded = await db.childRecords.filter(record => 
    !record.uploadedAt && record.status !== 'uploaded' && record.status !== 'pending' && record.status !== 'failed'
  ).toArray();
  
  // Combine and deduplicate by healthId
  const combined = [...pendingOrFailed, ...neverUploaded];
  const unique = combined.filter((record, index, self) => 
    index === self.findIndex(r => r.healthId === record.healthId)
  );
  
  return unique;
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

// Remove all successfully uploaded records from local storage
export async function removeUploadedRecords() {
  console.log('🗑️ Removing all uploaded records from local storage...');
  const uploaded = await db.childRecords.where('status').equals('uploaded').toArray();
  console.log(`📊 Found ${uploaded.length} uploaded records to remove`);
  
  if (uploaded.length > 0) {
    await db.childRecords.bulkDelete(uploaded.map(r => r.healthId));
    console.log(`✅ Removed ${uploaded.length} uploaded records from local storage`);
  }
  
  return uploaded.length;
}

// Remove specific records by their healthId array
export async function removeSpecificRecords(healthIds) {
  console.log(`🗑️ Removing ${healthIds.length} specific records from local storage...`);
  
  if (healthIds.length > 0) {
    await db.childRecords.bulkDelete(healthIds);
    console.log(`✅ Removed ${healthIds.length} specific records from local storage`);
  }
  
  return healthIds.length;
}
