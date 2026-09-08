/**
 * Real capture inputs: camera, gallery and files.
 *
 * Permission is requested at the moment the user picks a source, never up
 * front, and a denial leaves every other route open — blueprint §7 and §4.
 *
 * Each function returns bytes plus provenance, or a typed reason it could not.
 * Nothing here writes to the vault; the caller commits the original first and
 * then builds a draft around it, so a crash mid-capture leaves a recoverable
 * file rather than a half-written record.
 */

import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { Linking } from "react-native";

export type CaptureSource = "camera" | "gallery" | "file";

export interface CapturedFile {
  bytes: Uint8Array;
  fileName: string;
  mimeType: string;
  source: CaptureSource;
}

export type CaptureResult =
  | { status: "captured"; file: CapturedFile }
  | { status: "cancelled" }
  | { status: "permission_denied"; source: CaptureSource; canAskAgain: boolean }
  | { status: "failed"; reason: string };

const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

function extensionFor(mimeType: string, fallbackName: string): string {
  if (mimeType === "image/png") return ".png";
  if (mimeType === "image/jpeg" || mimeType === "image/jpg") return ".jpg";
  if (mimeType === "image/webp") return ".webp";
  if (mimeType === "application/pdf") return ".pdf";
  const dot = fallbackName.lastIndexOf(".");
  return dot > 0 ? fallbackName.slice(dot) : ".bin";
}

function readLocalFile(uri: string): Uint8Array {
  return new File(uri).bytesSync();
}

async function fromImagePicker(
  source: "camera" | "gallery",
  result: ImagePicker.ImagePickerResult,
): Promise<CaptureResult> {
  if (result.canceled) return { status: "cancelled" };

  const asset = result.assets?.[0];
  if (!asset) return { status: "failed", reason: "No image was returned." };

  try {
    const bytes = readLocalFile(asset.uri);
    if (bytes.length > MAX_ATTACHMENT_BYTES) {
      return {
        status: "failed",
        reason: `That file is ${(bytes.length / 1024 / 1024).toFixed(1)} MB. The limit is 25 MB.`,
      };
    }
    const mimeType = asset.mimeType ?? "image/jpeg";
    const baseName = asset.fileName ?? `capture-${Date.now()}`;
    return {
      status: "captured",
      file: {
        bytes,
        fileName: baseName.includes(".")
          ? baseName
          : `${baseName}${extensionFor(mimeType, baseName)}`,
        mimeType,
        source,
      },
    };
  } catch (error) {
    return {
      status: "failed",
      reason: error instanceof Error ? error.message : "The image could not be read.",
    };
  }
}

/** Takes a photo. Asks for the camera permission only when this is called. */
export async function captureFromCamera(): Promise<CaptureResult> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    return {
      status: "permission_denied",
      source: "camera",
      canAskAgain: permission.canAskAgain,
    };
  }

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ["images"],
    quality: 0.85,
    exif: false,
  });
  return fromImagePicker("camera", result);
}

/**
 * Picks an existing photo or screenshot.
 *
 * Uses the system picker, which hands back one chosen image without the app
 * gaining access to the whole library — §7 asks for exactly that.
 */
export async function captureFromGallery(): Promise<CaptureResult> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    quality: 0.9,
    exif: false,
  });
  return fromImagePicker("gallery", result);
}

/** Imports a PDF or image through the system document picker. */
export async function captureFromFiles(): Promise<CaptureResult> {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: ["application/pdf", "image/*"],
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled) return { status: "cancelled" };

    const asset = result.assets?.[0];
    if (!asset) return { status: "failed", reason: "No file was returned." };

    const bytes = readLocalFile(asset.uri);
    if (bytes.length > MAX_ATTACHMENT_BYTES) {
      return {
        status: "failed",
        reason: `That file is ${(bytes.length / 1024 / 1024).toFixed(1)} MB. The limit is 25 MB.`,
      };
    }
    const mimeType = asset.mimeType ?? "application/octet-stream";
    return {
      status: "captured",
      file: {
        bytes,
        fileName: asset.name ?? `document-${Date.now()}${extensionFor(mimeType, "")}`,
        mimeType,
        source: "file",
      },
    };
  } catch (error) {
    return {
      status: "failed",
      reason: error instanceof Error ? error.message : "The file could not be read.",
    };
  }
}

/**
 * Human-readable explanation for a denied permission.
 *
 * When Android will no longer show the prompt the only route is the system
 * settings page, so callers pair this with `openAppSettings` rather than
 * telling the user to go and find it themselves.
 */
export function permissionDeniedMessage(result: {
  source: CaptureSource;
  canAskAgain: boolean;
}): string {
  const what = result.source === "camera" ? "the camera" : "your files";
  return result.canAskAgain
    ? `Keeptrail needs access to ${what} for this. You can still choose a photo or type the receipt in by hand.`
    : `Access to ${what} is turned off for Keeptrail in Android settings. You can still choose a photo or type the receipt in by hand.`;
}

/** Opens this app's page in Android settings, for a permanently denied permission. */
export async function openAppSettings(): Promise<void> {
  await Linking.openSettings();
}
