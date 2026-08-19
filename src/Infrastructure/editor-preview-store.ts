/**
 * Editor-only snapshot cache. Not part of the Project document and not part of
 * the V1 deployment package (`*.asset.json`, `binary: false`).
 *
 * Images keep the original file bytes (PNG alpha included). Videos keep only
 * the captured first-frame poster. Audio has no visual snapshot.
 */

export type StoredEditorPreview = {
  readonly projectId: string;
  readonly assetId: string;
  readonly kind: "image" | "video";
  readonly mime: string;
  readonly blob: Blob;
};

export interface EditorPreviewStore {
  put(record: StoredEditorPreview): Promise<void>;
  get(projectId: string, assetId: string): Promise<StoredEditorPreview | undefined>;
  getForProject(projectId: string, assetIds: readonly string[]): Promise<readonly StoredEditorPreview[]>;
  delete(projectId: string, assetIds: readonly string[]): Promise<void>;
}

const DB_NAME = "template-designer.editor-previews.v1";
const STORE_NAME = "previews";

function recordKey(projectId: string, assetId: string): string {
  return `${projectId}\0${assetId}`;
}

export class MemoryEditorPreviewStore implements EditorPreviewStore {
  private readonly records = new Map<string, StoredEditorPreview>();

  async put(record: StoredEditorPreview): Promise<void> {
    this.records.set(recordKey(record.projectId, record.assetId), record);
  }

  async get(projectId: string, assetId: string): Promise<StoredEditorPreview | undefined> {
    return this.records.get(recordKey(projectId, assetId));
  }

  async getForProject(projectId: string, assetIds: readonly string[]): Promise<readonly StoredEditorPreview[]> {
    if (!assetIds.length) return [];
    const wanted = new Set(assetIds);
    return [...this.records.values()].filter((record) => record.projectId === projectId && wanted.has(record.assetId));
  }

  async delete(projectId: string, assetIds: readonly string[]): Promise<void> {
    for (const assetId of assetIds) this.records.delete(recordKey(projectId, assetId));
  }
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB transaction failed"));
    transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB transaction aborted"));
  });
}

export class IndexedDbEditorPreviewStore implements EditorPreviewStore {
  private dbPromise: Promise<IDBDatabase> | undefined;

  private open(): Promise<IDBDatabase> {
    if (!this.dbPromise) {
      const pending = new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            const store = db.createObjectStore(STORE_NAME, { keyPath: ["projectId", "assetId"] });
            store.createIndex("projectId", "projectId", { unique: false });
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error("IndexedDB open failed"));
      });
      pending.catch(() => {
        if (this.dbPromise === pending) this.dbPromise = undefined;
      });
      this.dbPromise = pending;
    }
    return this.dbPromise;
  }

  async put(record: StoredEditorPreview): Promise<void> {
    const db = await this.open();
    const transaction = db.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(record);
    await transactionDone(transaction);
  }

  async get(projectId: string, assetId: string): Promise<StoredEditorPreview | undefined> {
    const db = await this.open();
    const transaction = db.transaction(STORE_NAME, "readonly");
    const result = await requestToPromise(transaction.objectStore(STORE_NAME).get([projectId, assetId]));
    return result as StoredEditorPreview | undefined;
  }

  async getForProject(projectId: string, assetIds: readonly string[]): Promise<readonly StoredEditorPreview[]> {
    if (!assetIds.length) return [];
    const db = await this.open();
    const transaction = db.transaction(STORE_NAME, "readonly");
    const rows = await requestToPromise(transaction.objectStore(STORE_NAME).index("projectId").getAll(projectId)) as StoredEditorPreview[];
    const wanted = new Set(assetIds);
    return rows.filter((record) => wanted.has(record.assetId));
  }

  async delete(projectId: string, assetIds: readonly string[]): Promise<void> {
    if (!assetIds.length) return;
    const db = await this.open();
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    for (const assetId of assetIds) store.delete([projectId, assetId]);
    await transactionDone(transaction);
  }
}

export function createEditorPreviewStore(): EditorPreviewStore {
  if (typeof indexedDB === "undefined") return new MemoryEditorPreviewStore();
  return new IndexedDbEditorPreviewStore();
}
