/**
 * Offline Capture Queue for Katibay Mobile.
 * Provides SQLite/in-memory persistent capture storage with deduplication and state tracking.
 */

export interface QueueItem {
  id: string; // Client UUID
  activity_id: string;
  image_uri: string;
  sha256: string;
  status: "queued" | "uploading" | "synced" | "failed";
  captured_at: string;
  retry_count: number;
  error_message: string | null;
  server_receipt_id: string | null;
}

export class OfflineQueueManager {
  private items: QueueItem[] = [];
  private listeners: Set<(items: QueueItem[]) => void> = new Set();

  constructor(initialItems: QueueItem[] = []) {
    this.items = [...initialItems];
  }

  public subscribe(callback: (items: QueueItem[]) => void): () => void {
    this.listeners.add(callback);
    callback([...this.items]);
    return () => this.listeners.delete(callback);
  }

  private notify(): void {
    const copy = [...this.items];
    this.listeners.forEach((listener) => listener(copy));
  }

  /**
   * Enqueues a captured receipt image.
   * Prevents duplicates by checking existing SHA-256 within the same activity queue.
   */
  public enqueueCapture(
    activityId: string,
    imageUri: string,
    sha256: string,
    idOverride?: string,
  ): { item: QueueItem; isDuplicate: boolean } {
    const existing = this.items.find(
      (item) => item.activity_id === activityId && item.sha256 === sha256,
    );

    if (existing) {
      return { item: existing, isDuplicate: true };
    }

    const newItem: QueueItem = {
      id: idOverride || `client-rec-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      activity_id: activityId,
      image_uri: imageUri,
      sha256,
      status: "queued",
      captured_at: new Date().toISOString(),
      retry_count: 0,
      error_message: null,
      server_receipt_id: null,
    };

    this.items.unshift(newItem);
    this.notify();
    return { item: newItem, isDuplicate: false };
  }

  public getAllItems(): QueueItem[] {
    return [...this.items];
  }

  public getQueuedItems(): QueueItem[] {
    return this.items.filter((item) => item.status === "queued" || item.status === "failed");
  }

  public getPendingCount(): number {
    return this.items.filter((item) => item.status !== "synced").length;
  }

  public updateStatus(id: string, status: QueueItem["status"], errorMessage?: string | null): void {
    const item = this.items.find((i) => i.id === id);
    if (item) {
      item.status = status;
      if (errorMessage !== undefined) {
        item.error_message = errorMessage;
      }
      if (status === "failed") {
        item.retry_count += 1;
      }
      this.notify();
    }
  }

  public reconcileServerId(id: string, serverReceiptId: string): void {
    const item = this.items.find((i) => i.id === id);
    if (item) {
      item.server_receipt_id = serverReceiptId;
      item.status = "synced";
      item.error_message = null;
      this.notify();
    }
  }

  public retryFailed(): void {
    this.items.forEach((item) => {
      if (item.status === "failed") {
        item.status = "queued";
        item.error_message = null;
      }
    });
    this.notify();
  }

  public clearSynced(): void {
    this.items = this.items.filter((item) => item.status !== "synced");
    this.notify();
  }

  public clearAll(): void {
    this.items = [];
    this.notify();
  }
}

// Global Singleton Instance for App Lifetime
export const offlineQueue = new OfflineQueueManager();
