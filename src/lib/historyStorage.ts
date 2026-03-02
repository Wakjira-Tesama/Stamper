/**
 * Stamp history stored in IndexedDB, auto-deletes entries older than 2 days.
 * Each browser has its own isolated history.
 */

const DB_NAME = 'securestamp_history_db';
const STORE_NAME = 'stamp_history';
const DB_VERSION = 1;
const TTL_MS = 2 * 24 * 60 * 60 * 1000; // 2 days

export interface HistoryEntry {
  id: string;
  inputName: string;
  outputName: string;
  date: string;
  stampName?: string;
  signatureName?: string;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function addHistoryEntry(entry: Omit<HistoryEntry, 'id'>): Promise<void> {
  await cleanExpired();
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put({ ...entry, id: crypto.randomUUID() });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getHistory(): Promise<HistoryEntry[]> {
  await cleanExpired();
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => {
      const entries = (req.result || []) as HistoryEntry[];
      entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      resolve(entries);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function deleteHistoryEntry(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function clearHistory(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function cleanExpired(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => {
      const now = Date.now();
      for (const entry of req.result || []) {
        if (now - new Date(entry.date).getTime() > TTL_MS) {
          store.delete(entry.id);
        }
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
