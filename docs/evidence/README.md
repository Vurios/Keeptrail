# Device verification evidence

Screenshots captured with `adb exec-out screencap -p` from the release APK
running on an Android 16 x86_64 emulator, for the L5 and L6 checks in
`docs/BUILD_STATUS.md`. They are the actual output of those runs, not mockups.

| File               | What it shows                                                                                                               |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| `onboarding.png`   | First launch after a clean install: the three-step guide, insets respected                                                  |
| `L5-forcestop.png` | After `am force-stop` and relaunch — every record, total, reminder and collection restored from the encrypted on-disk index |
| `L5-airplane.png`  | Cold start with airplane mode on (note the status-bar icon): fully functional                                               |
| `L5-reboot.png`    | After a full device reboot: records intact                                                                                  |
| `L6-upgrade.png`   | After an in-place `adb install -r` upgrade from v1.1.0 to v1.1.1: no data loss                                              |

The money shown, ₱1,552.40 across 2 records, is ₱302.40 + ₱1,250.00 — exact
integer minor-unit arithmetic on device, not a formatted approximation.
