/**
 * Background Sync Engine for Katibay Mobile.
 * Synchronizes queued offline captures with the FastAPI backend when connectivity is available.
 */

import { offlineQueue, type QueueItem, OfflineQueueManager } from "../queue/offline-queue";

export interface SyncResult {
  syncedCount: number;
  failedCount: number;
  reconciledIds: Array<{ localId: string; serverId: string }>;
}

export interface SyncUploader {
  uploadReceipt: (item: QueueItem) => Promise<{ serverReceiptId: string }>;
}

/**
 * Default mock uploader when offline or for standalone tests.
 */
export const defaultMockUploader: SyncUploader = {
  uploadReceipt: async (item: QueueItem) => {
    // Simulate server latency
    await new Promise((resolve) => setTimeout(resolve, 50));
    return {
      serverReceiptId: `srv-${item.sha256.substring(0, 8)}-${Date.now().toString(36)}`,
    };
  },
};

export class SyncManager {
  private queue: OfflineQueueManager;
  private isOnline: boolean = true;
  private isSyncing: boolean = false;
  private currentSyncPromise: Promise<SyncResult> | null = null;
  private uploader: SyncUploader;

  constructor(
    queue: OfflineQueueManager = offlineQueue,
    uploader: SyncUploader = defaultMockUploader,
  ) {
    this.queue = queue;
    this.uploader = uploader;
  }

  public setOnline(online: boolean): void {
    this.isOnline = online;
    if (online) {
      this.triggerSync();
    }
  }

  public getOnlineStatus(): boolean {
    return this.isOnline;
  }

  public getIsSyncing(): boolean {
    return this.isSyncing;
  }

  /**
   * Triggers upload of all pending queued items.
   * Returns active synchronization promise if already running.
   */
  public async triggerSync(): Promise<SyncResult> {
    if (!this.isOnline) {
      return { syncedCount: 0, failedCount: 0, reconciledIds: [] };
    }

    if (this.currentSyncPromise) {
      return this.currentSyncPromise;
    }

    this.currentSyncPromise = this.performSync();
    try {
      return await this.currentSyncPromise;
    } finally {
      this.currentSyncPromise = null;
    }
  }

  private async performSync(): Promise<SyncResult> {
    const pending = this.queue.getQueuedItems();
    if (pending.length === 0) {
      return { syncedCount: 0, failedCount: 0, reconciledIds: [] };
    }

    this.isSyncing = true;
    let syncedCount = 0;
    let failedCount = 0;
    const reconciledIds: Array<{ localId: string; serverId: string }> = [];

    for (const item of pending) {
      // Mark as uploading
      this.queue.updateStatus(item.id, "uploading");

      try {
        const { serverReceiptId } = await this.uploader.uploadReceipt(item);
        this.queue.reconcileServerId(item.id, serverReceiptId);
        reconciledIds.push({ localId: item.id, serverId: serverReceiptId });
        syncedCount += 1;
      } catch (err: any) {
        const msg = err?.message || "Network upload error";
        this.queue.updateStatus(item.id, "failed", msg);
        failedCount += 1;
      }
    }

    this.isSyncing = false;
    return { syncedCount, failedCount, reconciledIds };
  }
}

export const syncManager = new SyncManager();
