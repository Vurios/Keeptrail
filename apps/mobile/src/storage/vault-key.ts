/**
 * The device vault key.
 *
 * Held by `expo-secure-store`, which on Android is backed by the platform
 * keystore. The key material never lands in AsyncStorage, never appears in a
 * log, and is not derived from anything the user types — losing it is losing
 * the vault, which is exactly why an exported backup uses a separate,
 * password-derived key the user controls.
 *
 * The guide (S1) also asks that key invalidation be documented rather than
 * papered over. A key that has gone missing is reported to the caller as a
 * distinct outcome so the UI can say "this vault cannot be opened on this
 * device" instead of quietly presenting an empty vault.
 */

import * as SecureStore from "expo-secure-store";
import { Buffer } from "buffer";
import { generateVaultKey, VAULT_KEY_LENGTH_BYTES } from "@katibay/shared";

const KEY_ALIAS = "keeptrail.vault.key.v1";

export type VaultKeyOutcome =
  | { status: "ready"; key: Uint8Array; created: boolean }
  /** Secure storage worked but the stored value is unusable. */
  | { status: "invalidated"; reason: string }
  /** Secure storage itself is unavailable on this device. */
  | { status: "unavailable"; reason: string };

/**
 * Loads the device vault key, creating one on first run.
 *
 * Never regenerates a key when one is expected to exist: a fresh key would
 * make every stored record permanently unreadable while looking like success.
 */
export async function loadVaultKey(): Promise<VaultKeyOutcome> {
  let stored: string | null;
  try {
    stored = await SecureStore.getItemAsync(KEY_ALIAS);
  } catch (error) {
    return {
      status: "unavailable",
      reason:
        error instanceof Error
          ? `Secure storage could not be read (${error.message}).`
          : "Secure storage could not be read.",
    };
  }

  if (stored) {
    const key = new Uint8Array(Buffer.from(stored, "base64"));
    if (key.length !== VAULT_KEY_LENGTH_BYTES) {
      return {
        status: "invalidated",
        reason: "The stored vault key is the wrong length and cannot be used.",
      };
    }
    return { status: "ready", key, created: false };
  }

  const key = generateVaultKey();
  try {
    await SecureStore.setItemAsync(KEY_ALIAS, Buffer.from(key).toString("base64"), {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  } catch (error) {
    return {
      status: "unavailable",
      reason:
        error instanceof Error
          ? `A vault key could not be stored securely (${error.message}).`
          : "A vault key could not be stored securely.",
    };
  }

  return { status: "ready", key, created: true };
}
