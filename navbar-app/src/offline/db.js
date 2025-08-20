// Offline IndexedDB setup using Dexie
import Dexie from 'dexie';

export const db = new Dexie('nutrition_app');
db.version(1).stores({
  childRecords: '&healthId, status, createdAt'
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
