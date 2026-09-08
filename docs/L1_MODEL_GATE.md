# L1 — On-device model gate: findings and decision

**Date:** September 8, 2026
**Blueprint:** `Keeptrail_Free_APK_Pilot_Blueprint_V2.md` (Revision 8), §3 "Model
selection is an engineering gate", §5 "Two honest modes", and prompt L1.

**Decision: the gate is not passed. Basic Helper remains the sole mode, and the
app is not advertised as having a chatbot.** This is the outcome §5 explicitly
provides for, not a deferral dressed up as one.

---

## What the blueprint requires before a model ships

Prompt L1 and §3 set a specific bar. All of it has to hold, not most of it:

1. An embedded native runtime — "Do not run a laptop server, expose a localhost
   HTTP service, or treat an external Ollama endpoint as on-device."
2. One selected and **pinned** model with tokenizer, chat template,
   quantization, checksum, source and licence documented, including commercial
   redistribution rights.
3. At least 50 representative English/Taglish receipt questions, ambiguous date
   queries and injection attempts, measured on low, mid and high target devices,
   recording Android version, ABI, RAM, cold and warm load time, first-token
   time, total latency, crash rate, heat and battery.
4. For the strict offline pilot, the assets bundled in the installable delivery,
   with first-run airplane mode verified — and "Large assets may make APK
   sharing impractical; measure the result before committing."

## What was actually available

### Runtime

`llama.rn` is the maintained React Native binding of llama.cpp and the only
credible candidate for this stack.

```
$ npm view llama.rn version license dist-tags
version = '0.13.0-rc.2'
license = 'MIT'
{ rc: '0.7.0-rc.1', latest: '0.13.0-rc.2' }
```

The `latest` dist-tag points at a **release candidate**. There is no stable
release. The licence (MIT) is fine and the project is active, but shipping a
pre-release inference runtime into a pilot whose entire purpose is to test
whether people trust the app with their receipts trades the wrong risk. A crash
in the runtime takes the app down with it.

### Weights

Qwen2.5-1.5B-Instruct is the baseline §3 names, and it clears the licence bar:
Apache-2.0, 1.54 B parameters, commercial use permitted. Provenance and
redistribution are not the problem.

Size is. A 4-bit quantization of a 1.5 B model is roughly 0.9–1.1 GB. The
current pilot APK is 68 MB. Bundling weights takes the sideload artifact past
1 GB — a fifteen-fold increase for a testing build distributed by hand, which is
the "impractical" §3 warns about. The alternative §3 permits, an explicitly
named "model download required" variant, is a different product decision that
weakens the offline promise and needs the owner's call, not an implementer's.

### Devices

Requirement 3 cannot be satisfied here at all. Benchmarking needs low, mid and
high tier physical hardware. One emulator is not a device tier, and numbers from
an emulator would be worse than no numbers — they would look like evidence.

## Consequences for the shipped app

`§5` allows exactly two honest modes and requires the fallback be labelled as
what it is:

- The engine at `packages/shared/src/local-pilot/assistant-engine.ts` runs its
  deterministic path with `isModelAvailable: false`, set in
  `apps/mobile/src/vault-context.tsx`.
- The Ask Keeptrail app bar states the mode permanently, and the opening message
  says "I am a rule-based helper, not a chatbot — I answer a fixed set of
  questions and every total is calculated by the app."
- Nothing in the app, `PRODUCT.md`, `TESTER_GUIDE.md` or the store copy claims a
  chatbot, an AI assistant, or on-device inference.
- Every receipt workflow works without a model, which is the condition §3
  attaches to shipping the fallback at all.

The typed read-only tool surface the model would have used already exists and is
already what produces every answer, so wiring a model in later is a substitution
behind that interface rather than a rewrite.

## What would reopen this

In order, and none of it is work this pass could honestly complete:

1. A stable `llama.rn` release, or an equivalent maintained binding.
2. Three physical devices spanning the target tiers.
3. A 50-question benchmark run on them, published with the measurements §3
   lists, and a support threshold set from the results rather than from hope.
4. An owner decision on artifact size: bundle roughly 1 GB of weights, or ship
   the separately-named download variant with size, Wi-Fi choice, progress,
   resume, checksum and storage checks — accepting that the second one is not
   first-launch offline.
