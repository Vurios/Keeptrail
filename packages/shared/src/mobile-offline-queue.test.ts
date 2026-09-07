import { describe, expect, it, beforeEach } from "vitest";
import { OfflineQueueManager, type QueueItem } from "../../../apps/mobile/src/queue/offline-queue";
import { SyncManager, type SyncUploader } from "../../../apps/mobile/src/sync/sync-manager";
import { colors } from "../../../apps/mobile/src/theme/tokens";

describe("Katibay Mobile Offline Capture & Sync Engine", () => {
  let queue: OfflineQueueManager;
  let mockUploadedIds: string[];
  let uploader: SyncUploader;
  let sync: SyncManager;

  beforeEach(() => {
    queue = new OfflineQueueManager();
    mockUploadedIds = [];
    uploader = {
      uploadReceipt: async (item: QueueItem) => {
        mockUploadedIds.push(item.sha256);
        return {
          serverReceiptId: `srv-rec-${item.sha256.substring(0, 10)}`,
        };
      },
    };
    sync = new SyncManager(queue, uploader);
  });

  it("captures 10 receipts offline and enqueues them in queued status", () => {
    // 1. Simulate Airplane / Offline Mode
    sync.setOnline(false);
    expect(sync.getOnlineStatus()).toBe(false);

    // 2. Capture 10 distinct receipts
    for (let i = 1; i <= 10; i++) {
      const sha256 = `hash-receipt-sample-${i.toString().padStart(3, "0")}`;
      const uri = `file:///data/user/0/ph.katibay/receipts/cap_${i}.jpg`;
      const result = queue.enqueueCapture("act-summit-2026", uri, sha256);

      expect(result.isDuplicate).toBe(false);
      expect(result.item.status).toBe("queued");
      expect(result.item.sha256).toBe(sha256);
    }

    expect(queue.getAllItems().length).toBe(10);
    expect(queue.getPendingCount()).toBe(10);
    expect(queue.getQueuedItems().length).toBe(10);
  });

  it("prevents duplicates if the same receipt is captured multiple times offline", () => {
    const sha256 = "hash-duplicate-receipt-001";
    const uri1 = "file:///data/user/0/ph.katibay/receipts/cap_dup_1.jpg";
    const uri2 = "file:///data/user/0/ph.katibay/receipts/cap_dup_2.jpg";

    const first = queue.enqueueCapture("act-summit-2026", uri1, sha256);
    expect(first.isDuplicate).toBe(false);

    const second = queue.enqueueCapture("act-summit-2026", uri2, sha256);
    expect(second.isDuplicate).toBe(true);
    expect(second.item.id).toBe(first.item.id);

    expect(queue.getAllItems().length).toBe(1);
  });

  it("re-enabling network syncs all 10 offline captures with zero duplicates", async () => {
    // 1. Capture 10 receipts offline
    sync.setOnline(false);
    for (let i = 1; i <= 10; i++) {
      const sha256 = `hash-batch-reconcile-${i}`;
      const uri = `file:///data/user/0/ph.katibay/receipts/batch_${i}.jpg`;
      queue.enqueueCapture("act-summit-2026", uri, sha256);
    }

    expect(queue.getPendingCount()).toBe(10);
    expect(mockUploadedIds.length).toBe(0);

    // 2. Re-enable network connectivity and await synchronization
    sync.setOnline(true);
    expect(sync.getOnlineStatus()).toBe(true);

    const syncResult = await sync.triggerSync();

    // 3. Verify exactly 10 synced receipts with zero duplicates
    expect(syncResult.syncedCount).toBe(10);
    expect(syncResult.failedCount).toBe(0);
    expect(syncResult.reconciledIds.length).toBe(10);

    const allItems = queue.getAllItems();
    expect(allItems.length).toBe(10);
    allItems.forEach((item) => {
      expect(item.status).toBe("synced");
      expect(item.server_receipt_id).toBeDefined();
      expect(item.server_receipt_id?.startsWith("srv-rec-")).toBe(true);
    });

    expect(mockUploadedIds.length).toBe(10);
    const uniqueUploaded = new Set(mockUploadedIds);
    expect(uniqueUploaded.size).toBe(10);
  });

  it("supports retrying failed uploads", async () => {
    let failAttempts = 0;
    const flakeyUploader: SyncUploader = {
      uploadReceipt: async (item: QueueItem) => {
        if (failAttempts < 1) {
          failAttempts += 1;
          throw new Error("HTTP 503 Server Busy");
        }
        return { serverReceiptId: `srv-retry-ok-${item.id}` };
      },
    };

    const flakeySync = new SyncManager(queue, flakeyUploader);
    queue.enqueueCapture("act-summit-2026", "file:///cap.jpg", "hash-flakey");

    // First attempt fails
    const res1 = await flakeySync.triggerSync();
    expect(res1.failedCount).toBe(1);
    const item0 = queue.getAllItems()[0];
    expect(item0).toBeDefined();
    if (item0) {
      expect(item0.status).toBe("failed");
      expect(item0.retry_count).toBe(1);
    }

    // Retry resets status to queued
    queue.retryFailed();
    const itemRetry = queue.getAllItems()[0];
    expect(itemRetry?.status).toBe("queued");

    // Second attempt succeeds
    const res2 = await flakeySync.triggerSync();
    expect(res2.syncedCount).toBe(1);
    const itemSuccess = queue.getAllItems()[0];
    expect(itemSuccess?.status).toBe("synced");
  });

  it("mirrors design token names exactly from the web design system", () => {
    expect(colors.brand.primary).toBe("#0f372c");
    expect(colors.brand.accent).toBe("#c9973b");
    expect(colors.status.success.fill).toBe("#10b981");
    expect(colors.status.warning.fill).toBe("#f59e0b");
    expect(colors.status.danger.fill).toBe("#ef4444");
    expect(colors.status.info.fill).toBe("#3b82f6");
    expect(colors.status.neutral.fill).toBe("#6b7280");
  });
});
