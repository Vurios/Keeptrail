/**
 * Enforces the Revision 8 promise that this app is fully local.
 *
 * A one-off grep proves nothing about tomorrow's commit. These tests walk the
 * real source tree and the shipped dependency list on every run, so the claims
 * printed on the Vault and onboarding screens stay true or the build fails.
 *
 * Scope is the code that actually ships in the APK: the mobile app and the
 * shared package it imports. The preserved Katibay backend under `services/api`
 * is deliberately out of scope — it is retained history, not part of this
 * build.
 */

import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const MOBILE_ROOT = resolve(__dirname, "..");
const APP_ENTRY = resolve(__dirname, "../../App.tsx");
const SHARED_ROOT = resolve(__dirname, "../../../../packages/shared/src");
const PACKAGE_JSON = resolve(__dirname, "../../package.json");

function sourceFiles(root: string): string[] {
  const found: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        if (entry === "node_modules" || entry === "__tests__") continue;
        walk(full);
        continue;
      }
      if (!/\.(ts|tsx|js|jsx)$/.test(entry)) continue;
      if (/\.test\.(ts|tsx|js)$/.test(entry)) continue;
      found.push(full);
    }
  };
  walk(root);
  return found;
}

const SHIPPED_FILES = [...sourceFiles(MOBILE_ROOT), ...sourceFiles(SHARED_ROOT), APP_ENTRY];

function read(file: string): string {
  return readFileSync(file, "utf8");
}

/** Strips comments so prose about networking is not mistaken for networking. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

describe("no network calls ship in the app", () => {
  const NETWORK_CALLS = [
    { pattern: /\bfetch\s*\(/, name: "fetch()" },
    { pattern: /\bXMLHttpRequest\b/, name: "XMLHttpRequest" },
    { pattern: /\bnew\s+WebSocket\b/, name: "WebSocket" },
    { pattern: /\bnavigator\.sendBeacon\b/, name: "sendBeacon" },
    { pattern: /\bEventSource\b/, name: "EventSource" },
  ];

  it.each(NETWORK_CALLS)("contains no $name", ({ pattern }) => {
    const offenders = SHIPPED_FILES.filter((file) => pattern.test(stripComments(read(file)))).map(
      (file) => relative(MOBILE_ROOT, file),
    );
    expect(offenders).toEqual([]);
  });

  it("contains no http(s) endpoint literals", () => {
    // Documentation links in comments are fine; a URL in executable code is not.
    const offenders: string[] = [];
    for (const file of SHIPPED_FILES) {
      const code = stripComments(read(file));
      const matches = code.match(/https?:\/\/[^\s"'`)]+/g);
      if (!matches) continue;
      // Namespace URIs are identifiers, not endpoints.
      const endpoints = matches.filter((url) => !url.startsWith("http://schemas."));
      if (endpoints.length > 0) {
        offenders.push(`${relative(MOBILE_ROOT, file)}: ${endpoints.join(", ")}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe("no cloud, account, AI-service or billing dependencies ship", () => {
  const FORBIDDEN_IMPORTS = [
    "@supabase",
    "firebase",
    "@react-native-firebase",
    "@google/generative-ai",
    "openai",
    "@sentry",
    "@amplitude",
    "react-native-purchases",
    "react-native-iap",
    "@stripe",
    "expo-auth-session",
    "expo-updates",
    "@react-native-google-signin",
  ];

  it("declares none of them as dependencies", () => {
    const manifest = JSON.parse(read(PACKAGE_JSON)) as {
      dependencies?: Record<string, string>;
    };
    const declared = Object.keys(manifest.dependencies ?? {});
    const offenders = declared.filter((name) =>
      FORBIDDEN_IMPORTS.some((forbidden) => name.startsWith(forbidden)),
    );
    expect(offenders).toEqual([]);
  });

  it("imports none of them anywhere in shipped source", () => {
    const offenders: string[] = [];
    for (const file of SHIPPED_FILES) {
      const code = stripComments(read(file));
      for (const forbidden of FORBIDDEN_IMPORTS) {
        if (new RegExp(`from\\s+["']${forbidden}`).test(code)) {
          offenders.push(`${relative(MOBILE_ROOT, file)} -> ${forbidden}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("mentions no remote AI provider in shipped code", () => {
    const offenders: string[] = [];
    for (const file of SHIPPED_FILES) {
      const code = stripComments(read(file));
      if (/\b(gemini|generativelanguage|anthropic|openai)\b/i.test(code)) {
        offenders.push(relative(MOBILE_ROOT, file));
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe("no sync or account vocabulary survives in the local variant", () => {
  it("has no sync manager, offline upload queue or passport screen", () => {
    const banned = [
      "sync/sync-manager.ts",
      "queue/offline-queue.ts",
      "screens/QueueScreen.tsx",
      "screens/CameraScreen.tsx",
      "screens/PassportMobileScreen.tsx",
      "components/StatusChip.tsx",
    ];
    const present = banned.filter((name) => {
      try {
        statSync(join(MOBILE_ROOT, name));
        return true;
      } catch {
        return false;
      }
    });
    expect(present).toEqual([]);
  });
});

describe("the Android manifest matches the local-only promise", () => {
  const MANIFEST = resolve(__dirname, "../../android/app/src/main/AndroidManifest.xml");

  /**
   * Expo's prebuild expresses a blocked permission as a declaration carrying
   * `tools:node="remove"`, which the manifest merger strips from the final
   * merged manifest. Asserting the string is simply absent would therefore be
   * wrong — what matters is that every one of these is either missing or
   * explicitly removed, and that none is left as a live request.
   */
  const REMOVED_PERMISSIONS = [
    // No network code ships, so the OS should not even grant the capability.
    "android.permission.INTERNET",
    // expo-image-picker declares this for video; Keeptrail never records audio.
    "android.permission.RECORD_AUDIO",
    "android.permission.SYSTEM_ALERT_WINDOW",
    "android.permission.READ_EXTERNAL_STORAGE",
    "android.permission.WRITE_EXTERNAL_STORAGE",
  ];

  it.each(REMOVED_PERMISSIONS)("does not request %s", (permission) => {
    const manifest = read(MANIFEST);
    const declaration = new RegExp(
      `<uses-permission[^>]*android:name="${permission.replace(/\./g, ".")}"[^>]*/>`,
    );
    const match = manifest.match(declaration);
    if (!match) return; // Never declared at all: also correct.
    expect(match[0]).toContain('tools:node="remove"');
  });

  it("requests only the permissions a shipped feature uses", () => {
    const manifest = read(MANIFEST);
    const live = Array.from(
      manifest.matchAll(/<uses-permission android:name="([^"]+)"\s*\/>/g),
      (match) => match[1],
    );
    expect(live.sort()).toEqual([
      // Photo capture.
      "android.permission.CAMERA",
      // Reminder notifications.
      "android.permission.POST_NOTIFICATIONS",
      "android.permission.SCHEDULE_EXACT_ALARM",
      // Haptic feedback.
      "android.permission.VIBRATE",
    ]);
  });

  it("keeps private records out of Android's automatic cloud backup", () => {
    expect(read(MANIFEST)).toContain('android:allowBackup="false"');
  });

  it("leaves the system Back contract intact", () => {
    expect(read(MANIFEST)).toContain('android:enableOnBackInvokedCallback="true"');
  });
});
