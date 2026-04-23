# Pulse — Tech Stack & Dev Setup

## What the app is

Pulse is a unified iOS tracker for money, movement, and daily rituals. Single timeline, AI companion (Pal) for coaching and entry parsing, workout tracking with live rest timers, and email receipt auto-import.

18 screens total. Design handoff in `design_handoff/`.

---

## Tech Stack

### iOS App

| Layer | Choice |
|---|---|
| UI | SwiftUI (iOS 17+) |
| Local storage | SwiftData |
| Device sync | CloudKit |
| Health data | HealthKit |
| Charts | Swift Charts (native) |
| Animations | SwiftUI built-in (`withAnimation`, `Canvas`, `TimelineView`) |

### iOS Extensions

| Extension | Purpose |
|---|---|
| WidgetKit | Home screen spending/activity widget |
| ActivityKit | Lock screen workout timer (Live Activities) |
| UserNotifications | Reminders, email sync alerts |

### Backend (DigitalOcean droplet — already running)

| Component | Detail |
|---|---|
| AI proxy server | Node.js or Python, 3 endpoints |
| Endpoints | `POST /chat`, `POST /review`, `POST /parse` |
| AI model | Anthropic API — Claude Haiku 4.5 |
| Email worker | IMAP polling, receipt parsing, push to device |

Never ship the Anthropic API key in the app — always proxy through the server.

---

## Dev Setup

```
Windows machine (VS Code)
        │
        │ VS Code Remote - SSH
        ▼
    Mac Mini
        ├── Swift compiler
        ├── xcodebuild (headless, no Xcode window)
        ├── iOS Simulator (viewed via screen share)
        └── Xcode (for signing, archiving)
```

- Edit code in VS Code on Windows via Remote - SSH extension
- Build via `xcodebuild` in SSH terminal — no GUI opens on Mac
- View simulator over screen share (macOS built-in or RealVNC)
- Other person can use the Mac normally — SSH is a background process

---

## Animation

Everything uses SwiftUI's built-in animation system — no third-party library needed.

| Screen | Approach |
|---|---|
| Activity rings (800ms) | `Canvas` + `withAnimation(.easeInOut(duration: 0.8))` |
| PR badge celebration | `withAnimation(.spring(response: 0.4, dampingFraction: 0.6))` |
| Rest timer | `TimelineView(.periodic(from: .now, by: 1.0))` |
| Sheet slides (280ms) | Built-in `.sheet` modifier |
| Typing dots | `withAnimation(.easeInOut.repeatForever())` |
| Drag reorder | `List` with `.onMove` |

---

## Deployment

No Apple Developer account ($99/year) — personal use only.

**AltStore** for sideloading:
- Free Apple ID is sufficient
- AltServer runs on Windows machine, re-signs automatically over WiFi
- App expires every 7 days but AltStore handles renewal silently
- Mesh WiFi works as long as client isolation is off

**CloudKit** is automatic — no deployment needed, works with free Apple ID.

**APNs limitation:** Server-side push notifications (email sync) require a paid Developer account. Workaround: poll the server on a timer instead of push.

---

## Key Constraints

- **HealthKit** does not work in Simulator — real iPhone required for workout feature testing
- **Live Activities** require real device — Simulator support is limited
- **APNs** (server push) requires paid Developer account — use polling as workaround for personal use
- **Mac Mini** must run macOS 13.5 Ventura or later for Xcode 15+ (required for iOS 17 development)

---

## Build Phasing

### v1 — Core tracker
- Today screen and unified timeline
- Log entry (money, movement, ritual)
- Basic spending view
- AI chat (Ask Pal)

### v2 — Workouts + platform features
- Full workout tracking with live session screen
- Rest timer + PR detection
- Live Activities (lock screen timer)
- Home screen widgets

### v3 — Intelligence + email
- Monthly AI review
- Email receipt auto-import
- Ritual streaks and analytics
