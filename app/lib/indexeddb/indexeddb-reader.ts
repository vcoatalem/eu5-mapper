// indexeddb-reader.ts
// Worker IndexedDB client for opening connection and reading data

export class IndexedDBReader {
  private dbName: string;
  private version: number;
  private storeNames: string[];
  private db: IDBDatabase | null = null;

  constructor(dbName: string, version: number, storeNames: string[]) {
    this.dbName = dbName;
    this.version = version;
    this.storeNames = storeNames;
  }

  async open(): Promise<IDBDatabase> {
    if (this.db) return this.db;
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);
      request.onupgradeneeded = () => {
        // Reader should not create stores; do nothing
      };
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async get(storeName: string, key: IDBValidKey): Promise<any> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
}
