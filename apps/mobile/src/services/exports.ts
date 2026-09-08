/**
 * Local exports: CSV, PDF and the encrypted backup archive.
 *
 * The blueprint (§4, §6) is specific about what an export is and is not. A CSV
 * is a summary, not a backup. A share destination the user picks may be a cloud
 * drive, and that is *their* export, not app sync — so the copy around these
 * calls says "you are sending this file somewhere" rather than implying
 * Keeptrail did the uploading.
 *
 * Files are written to the cache directory, which is the correct place for
 * regenerable derivatives, and cleaned up on the next export so temporary
 * copies of receipt data do not accumulate.
 */

import { Directory, File, Paths } from "expo-file-system";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import * as DocumentPicker from "expo-document-picker";
import { buildReceiptsCsv, buildReceiptsReportHtml, type ReportScope } from "@katibay/shared";
import type { CollectionRecord, ReceiptRecord } from "@katibay/shared";

const EXPORT_DIR_NAME = "exports";

function exportsDirectory(): Directory {
  // Cache, not documents: these are rebuildable derivatives of the vault.
  const directory = new Directory(Paths.cache, EXPORT_DIR_NAME);
  if (!directory.exists) directory.create({ intermediates: true, idempotent: true });
  return directory;
}

/**
 * Removes previously generated exports.
 *
 * Documented policy (§4): a temporary share copy of receipt data lives only
 * until the next export or the next launch, whichever comes first.
 */
export function clearGeneratedExports(): void {
  const directory = exportsDirectory();
  for (const entry of directory.list()) {
    if (entry instanceof File) entry.delete();
  }
}

function timestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

export interface ExportedFile {
  uri: string;
  fileName: string;
  sizeBytes: number;
}

export function writeCsvExport(
  receipts: ReceiptRecord[],
  collections: CollectionRecord[],
): ExportedFile {
  clearGeneratedExports();
  const csv = buildReceiptsCsv(receipts, collections);
  const fileName = `keeptrail-receipts-${timestamp()}.csv`;
  const file = new File(exportsDirectory(), fileName);
  file.create({ overwrite: true });
  // A BOM so spreadsheet apps read the peso sign as UTF-8 rather than mojibake.
  file.write(`﻿${csv}`);
  return { uri: file.uri, fileName, sizeBytes: file.size };
}

export async function writePdfExport(
  receipts: ReceiptRecord[],
  collections: CollectionRecord[],
  scope: ReportScope,
): Promise<ExportedFile> {
  clearGeneratedExports();
  const html = buildReceiptsReportHtml(receipts, collections, scope);
  const { uri } = await Print.printToFileAsync({ html, base64: false });

  // printToFileAsync names the file with a UUID; move it somewhere the share
  // sheet will show a meaningful name.
  const fileName = `keeptrail-report-${timestamp()}.pdf`;
  const target = new File(exportsDirectory(), fileName);
  if (target.exists) target.delete();
  new File(uri).moveSync(target);

  return { uri: target.uri, fileName, sizeBytes: target.size };
}

export async function isSharingAvailable(): Promise<boolean> {
  return Sharing.isAvailableAsync();
}

/**
 * Hands a generated file to the system share sheet.
 *
 * Where it goes is the user's choice, including a cloud drive. That is a
 * user-controlled export; the app never uploads anything itself.
 */
export async function shareFile(
  file: ExportedFile,
  mimeType: string,
  dialogTitle: string,
): Promise<void> {
  await Sharing.shareAsync(file.uri, {
    mimeType,
    dialogTitle,
    UTI: mimeType === "application/pdf" ? "com.adobe.pdf" : "public.comma-separated-values-text",
  });
}

export type ArchivePickResult =
  | { status: "picked"; uri: string; name: string; sizeBytes: number }
  | { status: "cancelled" }
  | { status: "failed"; reason: string };

/**
 * Opens the system document picker so a backup can be restored from anywhere
 * the user can reach — a memory card, Downloads, or a cloud drive they have
 * synced themselves.
 *
 * `.keeptrail` has no registered MIME type, so the picker accepts any file and
 * the archive header is what actually validates it. Handing a wrong file to
 * restore fails safely: the magic bytes are checked before any decryption and
 * long before any record is touched.
 */
export async function pickBackupArchive(): Promise<ArchivePickResult> {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: "*/*",
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled) return { status: "cancelled" };

    const asset = result.assets?.[0];
    if (!asset) return { status: "failed", reason: "No file was returned." };

    return {
      status: "picked",
      uri: asset.uri,
      name: asset.name ?? "backup.keeptrail",
      sizeBytes: asset.size ?? 0,
    };
  } catch (error) {
    return {
      status: "failed",
      reason: error instanceof Error ? error.message : "The file could not be opened.",
    };
  }
}

/** Reads a picked archive off disk. */
export function readPickedArchive(uri: string): Uint8Array {
  return new File(uri).bytesSync();
}
