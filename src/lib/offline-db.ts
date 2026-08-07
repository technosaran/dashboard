/**
 * High-Performance Offline-First Storage Engine using Browser IndexedDB
 * Allows 0ms instant loading for dashboard data, syncing with Supabase in background.
 */

const DB_NAME = "FinanceOS_Offline_Cache";
const STORE_NAME = "dashboard_snapshots";
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !("indexedDB" in window)) {
      return reject(new Error("IndexedDB not supported in current environment"));
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "key" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function setOfflineCache<T>(key: string, data: T): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.put({ key, data, updatedAt: Date.now() });
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn("IndexedDB setCache write warning:", err);
  }
}

export async function getOfflineCache<T>(key: string): Promise<T | null> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(key);

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        const result = request.result;
        resolve(result ? (result.data as T) : null);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn("IndexedDB getCache read warning:", err);
    return null;
  }
}

export async function clearOfflineCache(): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.clear();
  } catch (err) {
    console.warn("IndexedDB clearCache error:", err);
  }
}
