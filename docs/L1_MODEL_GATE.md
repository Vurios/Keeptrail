# L1 — On-device model gate: findings and decision

**Date:** September 9, 2026 (supersedes the September 8 revision)
**Blueprint:** `Keeptrail_Free_APK_Pilot_Blueprint_V2.md` (Revision 8), §3 "Model
selection is an engineering gate", §5 "Two honest modes", prompt L1.

**Decision: ship a real on-device model.** `react-native-executorch` with
Qwen 3 0.6B (4-bit) is production-viable today, and the assistant is redesigned
so that a 0.6B model is not merely adequate but the right size for the job.

---

## Correction to the previous revision

The September 8 revision of this document concluded that no stable React Native
LLM runtime existed and that Basic Helper must remain the only mode. **That
conclusion was wrong.** It rested on a single package, `llama.rn`, whose
`latest` dist-tag is still a release candidate (`0.13.0-rc.2`). A wider search
found a stable, maintained alternative that was not considered.

The corrected survey is below.

---

## Runtime survey

| Runtime                       | Version             | Licence | Min Android                       | Verdict                                                                                                                                                                                                                                        |
| ----------------------------- | ------------------- | ------- | --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`react-native-executorch`** | **0.10.0 (stable)** | MIT     | **13 (API 33)**                   | **Chosen.** Meta's ExecuTorch under a React Native binding from Software Mansion, who also maintain Reanimated and Gesture Handler. Expo support via development builds on SDK 54+. Ships pre-exported Qwen 3, Llama 3.2, Phi 4 Mini, SmolLM 2 |
| `llama.rn`                    | 0.13.0-rc.2         | MIT     | 7                                 | Rejected. `latest` is a release candidate; there is no stable release to depend on for a vault app                                                                                                                                             |
| `cactus-react-native`         | 1.13.1              | MIT     | 7 (API 24)                        | Rejected. Best device coverage of the three and int4 models at 300–500 MB resident — but the repository was **archived read-only on 23 July 2026**. An abandoned inference runtime is not something to build a product on                      |
| ML Kit GenAI / Gemini Nano    | Alpha (Prompt API)  | Google  | Pixel 8+, Galaxy S24+ and similar | Rejected as the primary path. Narrower reach than Android 13+, requires native Android code with no first-class RN binding, and the Prompt API is still Alpha. Worth revisiting as an accelerated path on supported flagships                  |

### Device reach, stated plainly

`react-native-executorch` requires **Android 13 or newer**. Android 13, 14, 15
and 16 together are roughly **58%** of the global Android install base. That
share skews lower in the budget-phone markets Keeptrail is aimed at.

So this is a gate, not a universal capability, and §3 anticipates exactly that:
"If a true chatbot is mandatory for a particular release, restrict that
release's supported device range rather than pretending all devices support
it." The app's `minSdk` stays at 24 — the receipt workflows have no reason to
exclude anyone — and the model is an optional capability that unlocks where the
hardware supports it.

For reference, this is not unusual: Tarsi's on-device AI runs on Apple
Intelligence, which requires iPhone 15 Pro or newer — a considerably narrower
slice than Android 13+.

---

## Model selection

**Qwen 3 0.6B, 4-bit quantized**, from the pre-exported `.pte` collection the
runtime publishes.

- **Licence:** Apache-2.0. Commercial redistribution permitted; no
  attribution trap, no field-of-use restriction.
- **Download:** roughly 350–550 MB depending on the quantization variant. This
  is why it is fetched on demand rather than bundled: adding it to the APK
  would take a 77 MB sideload artifact past 500 MB, which §3 warns is
  impractical for hand distribution.
- **Resident memory:** a 4-bit model in this class sits in the few-hundred-MB
  range during inference. It is released when the assistant screen closes.

Per §3, the download is an explicitly named step with size, a Wi-Fi choice,
progress, resume, checksum and a storage check — and the app does not claim
first-run offline availability for the assistant until that download completes.
Every receipt workflow remains fully offline from first launch regardless.

---

## Why 0.6B is the right size, not a compromise

The blueprint's trusted-execution contract already forbids the model from
producing numbers: "Render money and aggregate cards from trusted structured
results rather than accepting model-generated arithmetic."

That constraint decides the model size. The model's entire job is:

> free-form question → a validated call to one of six typed read-only tools

It never writes an answer, never sums anything, never invents a merchant. It
maps "how much did I spend at that coffee place near the office last month" to
`summarizeReceipts({ merchant: "Highland Coffee", from: "2026-08-01", to:
"2026-08-31" })`, and application code produces the figure.

Intent-and-slot extraction with a constrained output shape is a task 0.6B models
do genuinely well. A 4B model would be better at open-ended conversation, which
is not what this feature is for and which the blueprint explicitly does not want
it doing.

---

## What must still be measured

Requirement 3 of prompt L1 — 50 representative English and Taglish questions
across low, mid and high device tiers, recording cold load, first-token time,
total latency, RAM, crash rate, heat and battery — has **not** been done. One
emulator is not a device tier, and numbers from it would look like evidence
without being any.

The support threshold must be set from those measurements before the assistant
is advertised as a chatbot anywhere in the store listing. Until then the feature
ships labelled by what it is doing on that specific device.

---

## Fallback for devices below the gate

Devices that cannot run the model keep every receipt workflow and get the
deterministic assistant. That path is being rebuilt as a real grammar-based
parser over intents, date expressions, merchants and amounts — not the
`String.includes` keyword matching it uses today, which breaks on any phrasing
it did not anticipate. It is labelled honestly and never described as a chatbot.
