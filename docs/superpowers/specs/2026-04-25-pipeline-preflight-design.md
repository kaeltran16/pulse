# Sub-project 0 — Pipeline Pre-flight Design

**Date:** 2026-04-25
**Status:** Draft, pending user review
**Parent spec:** `2026-04-25-implementation-process-design.md`

---

## 1. Goal

Prove the Windows-only Expo dev pipeline end-to-end on a hello-world before any feature code is written.

## 2. Success criteria (binary)

The default `create-expo-app` starter, unchanged, runs successfully in **both** of:
- An Android emulator (Pixel 7 / API 34) on the Windows machine
- Expo Go on the user's iPhone

Both runtimes:
- Display the default starter screen
- React to hot reload (edit a string in the source, see it update without rebuild)

If both pass: pre-flight succeeds. If either fails: pre-flight is incomplete; the failure mode is the deliverable to fix before any subsequent sub-project starts.

## 3. Scope

In scope:
- Install Node LTS on Windows
- Install Android Studio + create + boot a Pixel 7 / API 34 emulator
- Install Expo Go on the iPhone (App Store)
- Scaffold the Expo app into the existing `pulse/` repo via `npx create-expo-app@latest .` (SDK 55+ defaults to TypeScript)
- Set bundle identifier `com.kael.pulse` and display name "Pulse" in `app.json`
- Run `npx expo start`, connect both runtimes, verify hot reload on both

Out of scope (deferred to later sub-projects):
- Expo Router smoke test (deferred — user opted minimum)
- Theme provider, design tokens, components (sub-project 1)
- Backend scaffolding (sub-project 2)
- EAS Build account, custom dev clients, Anthropic API key, DO droplet setup
- `STACK.md` / `README.md` content updates beyond a one-line "stack pivoted to RN+Expo, see meta-spec"

## 4. Stack details locked at this stage

| Item | Value |
|---|---|
| Expo SDK | **SDK 55** (current stable as of 2026-04-25, ships with RN 0.83). If a newer SDK is stable at install time, use it. |
| New Architecture | Enabled — mandatory in SDK 55, no opt-out |
| Template | Default `create-expo-app` template (TypeScript-by-default since SDK 55) |
| Language | TypeScript, strict mode (default in template) |
| Bundle identifier (iOS) | `com.kael.pulse` |
| Android package | `com.kael.pulse` |
| Display name | Pulse |
| Repo | Existing `pulse/` — scaffold in place, do not nest |

## 5. Tooling to install on Windows

- **Node.js LTS** (currently 20.x or 22.x — pick the version Expo SDK officially supports)
- **Git** (already installed — confirmed)
- **Android Studio** with:
  - Android SDK (API 34)
  - Pixel 7 system image (API 34, Google APIs)
  - One AVD created and booting cleanly
- **Optional but recommended:** Windows Terminal, or VS Code's integrated terminal

## 6. Tooling to install on iPhone

- **Expo Go** from the App Store (free)
- iPhone and Windows machine on the same Wi-Fi network
- No Expo account required (Expo Go works for local LAN dev without login)

## 7. Risk register

Pre-flight is binary, but the failure modes that can surface here are valuable to learn now:

| Risk | Likelihood | Mitigation |
|---|---|---|
| Android emulator HAXM / WHPX virtualization fails on Windows | Medium | Enable Hyper-V or WHPX in Windows Features; if BIOS-disabled, fall back to physical Android device or skip emulator and rely on Expo Go only |
| iPhone can't see Metro server (Wi-Fi isolation, firewall, AP isolation, VPN) | Medium-high | Disable VPN; check Windows Defender Firewall allows port 8081; same SSID as iPhone; if router has client isolation, use a hotspot or `--tunnel` flag |
| `--tunnel` mode required (Expo's ngrok-style tunnel) if direct LAN fails | Medium | Acceptable fallback; slower but works through hostile networks |
| Node version mismatch with Expo SDK | Low | Install the version Expo's "Get Started" page currently recommends |
| Existing repo has a file collision with `create-expo-app` | Low | Repo currently contains only `README.md`, `STACK.md`, `design_handoff/`, `docs/`. The first three may collide with starter `README.md`. Resolve by hand at scaffold time. |

## 8. Verification protocol

In order:

1. `node --version` returns Node LTS major version
2. `npx expo --version` succeeds
3. Android emulator boots to home screen from `adb devices` listing
4. `npx expo start` runs, prints LAN URL + QR code
5. Pressing `a` in Expo CLI launches the app on the emulator → starter screen visible
6. Scanning QR with iPhone Camera (or Expo Go) launches the app on the iPhone → starter screen visible
7. Edit `App.tsx` (or `app/index.tsx` depending on template) to change the visible string; both runtimes update without manual reload

Take a screenshot of the starter running on the iPhone for the milestone commit.

## 9. Definition of done

- All seven steps in §8 pass
- `app.json` has bundle ID and display name set
- A one-line note added to `STACK.md`: *"Stack pivoted from SwiftUI to React Native + Expo. See `docs/superpowers/specs/2026-04-25-implementation-process-design.md`."*
- Initial Expo scaffolding committed with message `chore: scaffold Expo app (sub-project 0)`
- Hot-reload screenshot committed to `docs/superpowers/reviews/2026-XX-XX-pipeline-preflight-review.md` along with a one-paragraph "what failed, what surprised me" note

## 10. Out of scope reminders

These are tempting to add but explicitly belong in later sub-projects:

- Don't install Reanimated, Skia, Drizzle, `expo-sqlite`, or any feature dependency
- Don't create theme tokens or color extensions
- Don't set up EAS account
- Don't create the `backend/` directory
- Don't write any test infrastructure (no Jest, no test runner setup)
- Don't restructure the repo beyond what `create-expo-app` produces
