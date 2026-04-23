# Handoff: ExpensePal iOS App

A unified iOS tracker for **money, movement, and daily rituals** — one app, one timeline, three lightweight trackers that share data to produce cross-cutting insights (e.g. *"on morning-ritual days, food spending drops 32%"*). Includes an AI companion ("Pal") for natural-language chat, automatic monthly reviews, smart suggestions, a **full gym-workout flow** (routines, live set-by-set tracking, rest timer, PRs, post-session summary), and **email sync** that auto-imports receipts from Gmail/Outlook over IMAP.

---

## About the Design Files

The files in this bundle are **design references created in HTML** — React prototypes rendering inside an iPhone frame, showing intended look, feel, and behavior. They are **not** production code to ship directly.

Your job is to **recreate these designs in the target codebase's environment** — ideally **SwiftUI** (see "Implementation Notes" below) — using its established patterns and libraries. If the target codebase uses a different stack (React Native, Flutter, etc.), use it; the designs are platform-agnostic but visually adhere to iOS 17 conventions.

Every visual decision (colors, type, spacing, component structure, copy) is pinned down in this README so you can build from the doc alone. Open `ExpensePal.html` in a browser to see the full 18-screen canvas live — pan, zoom, and focus any screen for pixel-level reference.

---

## Fidelity

**High-fidelity.** The mocks include final:
- Color palette (iOS system colors, light + dark, 8 accent options)
- Typography (SF Pro Display / Text / Rounded / Mono, sizes, weights, tracking)
- Spacing, corner radii, hairlines
- Component structure and interaction states (idle / active / done / loading)
- Copy and microcopy (exact strings to ship, including AI prompts)
- Interaction patterns (sheets, nav push, tab switch, FAB, drag-reorder, swipe)

Treat this as a pixel-perfect reference. If a detail isn't documented here, match what you see in the HTML prototype.

---

## Implementation Notes (recommended stack)

| Concern | Recommendation |
|---|---|
| UI framework | **SwiftUI** (iOS 17+) |
| Local storage | **SwiftData** for v1 |
| Sync | **CloudKit** (v1.1) |
| Health data | **HealthKit** — auto-import workouts, steps, active energy |
| Email ingest | **IMAP** via a server-side worker; app stores only credentials reference + parsed entries |
| Notifications | **UserNotifications** — ritual reminders, budget alerts |
| Charts | **Swift Charts** (native, matches system feel) |
| LLM | Anthropic API via your own proxy server — **never ship the API key in the app** |
| Auth (when added) | Sign in with Apple |

### Data model sketch (SwiftData)

```swift
@Model class Entry {
  var id: UUID
  var timestamp: Date
  var type: EntryType       // .money | .move | .rituals
  var title: String
  var detail: String?
  var amount: Double?        // money: negative = expense, positive = income
  var duration: Int?         // move / rituals: minutes
  var calories: Int?         // move only
  var distance: Double?      // move only, km
  var category: String?      // money only
  var ritualId: UUID?        // rituals only, FK to Ritual
  var note: String?
  var source: EntrySource    // .manual | .email | .health | .nlParsed
  var sourceRef: String?     // emailMessageId, healthWorkoutUUID, etc.
  var workoutId: UUID?       // links to Workout if type == .move and strength session
}

@Model class Workout {
  var id: UUID
  var routineId: UUID?
  var name: String           // e.g. "Push Day A"
  var startedAt: Date
  var endedAt: Date?
  var sets: [SetLog]         // [{exerciseId, weight, reps, done, isPR}]
  var totalVolumeKg: Double  // derived
  var prCount: Int           // derived
}

@Model class Routine {
  var id: UUID
  var name: String
  var tag: RoutineTag        // .upper | .lower | .full | .cardio | .custom
  var exercises: [RoutineExercise]  // ordered
  var restSeconds: Int
  var warmupReminder: Bool
  var autoProgress: Bool
}

@Model class Ritual {
  var id: UUID
  var title: String
  var icon: String           // SF Symbol name
  var cadence: Cadence
  var reminderTime: Date?
  var order: Int
  var streak: Int
}

@Model class Goals {
  var dailyBudget: Double      // $85 default
  var dailyMoveMinutes: Int    // 60 default
  var dailyRitualTarget: Int   // 5 default
}

@Model class EmailAccount {
  var address: String
  var provider: Provider       // .gmail | .outlook | .other
  var appPasswordRef: String   // keychain reference, never stored in-model
  var imapHost: String         // default imap.gmail.com
  var imapPort: Int            // default 993
  var lastSyncedAt: Date?
  var autoSyncInterval: Int    // minutes; 15 default
  var senderFilters: [String]  // allowlist of sender domains/addresses
}
```

### LLM proxy

Three server endpoints, all forward to Anthropic's Messages API (`claude-haiku-4-5` is fine for latency):

- `POST /chat` — Ask Pal free-form chat (messages array)
- `POST /review` — Monthly review generation (month-summary JSON → 2–3 sentence narrative)
- `POST /parse` — Natural-language entry parsing (free-text → structured `Entry`)

See **AI Prompts** section below for exact system prompts.

### Email proxy

A server worker that:
1. Stores IMAP credentials securely (the iOS app only ever holds a keychain-backed reference)
2. Runs on the schedule the user picks (15m default)
3. Filters inbox by sender rules, parses receipts (amount, merchant, date), dedupes, and pushes structured `Entry` records back to the device via push + fetch-on-open
4. Reports sync status back so the UI can render the progress line

---

## The 18 Screens

| # | Screen | Purpose |
|---|---|---|
| 01 | Onboarding | First-run: budget, move goal, pick 5 rituals |
| 02 | Today (home) | Activity rings + 3-up tiles + timeline + evening reflection |
| 03 | Quick Actions | FAB-triggered action grid (overlay sheet) |
| 04 | Log Entry | Modal: amount/duration entry, segmented type, keypad |
| 05 | Ask Pal | AI chat w/ suggestions and typing indicator |
| 06 | Spending Detail | Hero total + category breakdown + transactions |
| 07 | Move Tab | Movement landing: today's activity, recent workouts, "Start workout" CTA |
| 08 | Start Workout | Pre-session routine picker (Pal's pick + strength grid + cardio list) |
| 09 | Active Session | Live workout — set table, rest timer, progress dots |
| 10 | Post-Workout | Summary — stats, muscles worked, PRs, share/save |
| 11 | Exercise Library | Catalog — search, filter chips, grouped exercise list |
| 12 | Workout Detail | Past-session replay: stats, volume trend, full set tables, Pal's note |
| 13 | Rituals Tab | Ritual landing: today's list, streak, manage button |
| 14 | Monthly Review | AI-written narrative + stats + discovered patterns |
| 15 | You (profile) | Avatar, year stats, settings entry (incl. Integrations) |
| 16 | Email Sync · Intro | Unlinked state: value prop + providers + "Connect Gmail" CTA |
| 17 | Email Sync · Setup | App-password flow (3-step instructions + credential form) |
| 18 | Email Sync · Dashboard | Connected: sync-job hero, recent imports, schedule chip |

Detailed specs follow.

---

### 01 · Onboarding (4 in-screen steps)
**Purpose:** First-run setup. Collects daily budget, movement goal, and picks 5 daily rituals.

**Layout:**
- Full-screen, no nav bar, no tab bar
- Progress dots at top (centered, 6px height; active = 20px wide in accent; inactive = 6px wide, `theme.fill`)
- Hero glyph (96×96 rounded square, radius 28, tinted bg @ 12% alpha, glyph 56px centered)
- Headline (SF Pro Display 28/700), body (SF Pro Text 15, `ink2`), chip selector, CTA (full-width, 56px, accent bg, white text, radius 16)

**Steps:**
1. Welcome — *"Welcome to ExpensePal"* / *"One app for money, movement, and the little rituals that hold your day together."*
2. Daily budget — `$50 / $85 / $120 / $200` chips, default $85
3. Move goal — `20min / 45min / 60min / 90min` chips, default 60min
4. Rituals — multi-select 5 from suggested list

---

### 02 · Today (home)

**Purpose:** The hub. At-a-glance view of the day's money/movement/ritual progress + chronological timeline.

**Layout top-to-bottom:**
1. Large-title nav bar — *"Today"* + date subtitle (*"Wednesday, Apr 23"*)
2. **Activity rings hero** — Apple-Health style, 3 concentric rings (money=outer orange, move=middle green, rituals=inner purple). ~180px square, centered.
3. **3-up summary tiles** — each: icon (28px rounded, tint color) / label (SF 13 `ink3`) / big number (SF Rounded 28/700 tabular-nums) / sub-line (SF 12 `ink3`). 12px gap.
4. **Timeline** — newest first. Row: time (SF Mono 12 `ink3`) / icon (34×34, type color, r=9) / title (SF 16/500) / detail (SF 13 `ink3`) / value (SF Rounded 15, right-aligned, type color for money).
5. **Evening reflection card** (after 18:00) — subtle gradient bg, "Written by Pal" sparkle label, 2–3 sentence LLM summary, "Regenerate" pill.

**Interactions:** Summary tile tap → detail screen. Timeline row tap → entry-detail sheet (edit / recategorize / delete).

---

### 03 · Quick Actions (FAB overlay)

**Purpose:** Triggered by the center FAB. Grid of primary actions so common logs take one tap.

**Layout:**
- Full-screen dim overlay (`rgba(0,0,0,0.35)`)
- Grid of 6 action tiles (2 cols × 3 rows), each: icon square (48×48, type-color tinted), label below (SF 14/500)
- Tiles: "Log expense", "Log workout", "Start workout", "Complete ritual", "Ask Pal", "Voice entry"
- Cancel "×" top-right, or tap-outside to close
- Enters: scale-up from FAB + fade backdrop

---

### 04 · Log Entry (sheet)

**Purpose:** Quick-log anything. Modal sheet from bottom.

**Layout:**
- iOS modal, detent ~88% of screen
- "Cancel" / "New Entry" / **Add** (accent, disabled until valid)
- **Segmented control** — Expense / Workout / Ritual (iOS 17 style)
- **Big display** — SF Rounded 56 bold tabular-nums, centered. Money: `$ 0.00`. Move: `0 min`. Ritual: title field.
- **Quick-pick tiles** — recent/common ("Verve Coffee $5", "Tartine $16", "Run 30min", "Morning pages")
- **Numeric keypad** — 3×4 custom keypad for money/move
- **Optional fields** — category, note, time override

**Natural-language logging:** small "✨ Type it" button opens a text field; `/parse` LLM endpoint returns `{type, amount, category, title, note}`, pre-fills the form.

---

### 05 · Ask Pal (AI chat)

**Purpose:** Free-form conversational interface. Ask questions, get coaching, log things in plain English.

**Layout:**
- Large-title nav "Ask Pal" / "Your tracking companion"
- Scrollable messages (16px horizontal padding)
- User bubble: right, accent bg, white text, radius 18 (2px bottom-right)
- Assistant bubble: left, `theme.surface` bg, ink text, radius 18 (2px bottom-left), max-width 80%
- Typing indicator: 3 dots pulsing
- Input bar: rounded text field + circular send button (34×34, accent, paper-plane glyph)
- Empty state suggestion chips: *"Why was Friday expensive?"*, *"How am I doing this week?"*, *"Suggest an evening ritual"*

---

### 06 · Spending Detail

**Purpose:** Deep-dive on Money (same template reused for Move Detail and Rituals Detail).

**Layout:**
- Back button + "Spending" title + `+` trailing
- **Hero card**: big total ($60.35), progress vs budget (horizontal bar or donut)
- **Category breakdown** — rows (Food & Drink, Groceries, Transit…) with amount + bar
- **Recent transactions** — list grouped by day
- Bottom: *"Ask Pal about spending"* pill

---

### 07 · Move Tab

**Purpose:** Movement landing screen. Enters from the Move tab icon.

**Layout:**
- Large-title nav "Move" + date subtitle
- **Today's movement** summary card — minutes moved, active energy, heart-rate avg (SF Rounded 20/700 each, 3-column)
- **Start workout** primary CTA (full-width, move-color filled, 56px, radius 16) → screen 08
- **Recent workouts** list — 3–5 past sessions. Row: date (SF Mono 12 `ink3`) / routine name / duration + volume / chevron. Tap → screen 12.
- **Other activity** section — walk, run, HealthKit-imported
- "See all workouts" footer link

---

### 08 · Start Workout (Pre-workout)

**Purpose:** Routine picker. The entry point whenever the user presses "Start workout".

**Layout:**
- Large-title nav "Start workout" / "Pick a routine or freestyle"
- **Pal's pick card** — gradient bg (move→accent), "PAL'S PICK" sparkle label, 2-sentence AI suggestion (*"You hit push and cardio this week — pull is overdue. Try Pull Day A…"*), primary CTA "Start Pull Day A" (filled move pill) + "Another" pill to regenerate
- **Strength** section — 2-col grid. Card: icon square (34×34 tinted) / name (SF 15/600) / meta ("5 ex · ~55m") / footnote ("Last: 3d ago")
- **Cardio** section — rows with circular play-button trailing icon
- **Quick actions** (inset grouped): "New routine", "Exercise library", "Freestyle session"

---

### 09 · Active Session (the hero)

**Purpose:** What the user sees *during* a workout. Heads-down, minimal taps. Tracks every set, auto-runs rest timer.

**Layout top-to-bottom:**
1. **Colored header band** — full-width `theme.move` bg, safe-area padded
   - Down-chevron (minimize), centered title (*"ACTIVE · PUSH DAY A"* mono 11 uppercase + SF Rounded 28 tabular-nums elapsed time below), **Finish** pill (white bg, move-color text, radius 100, 8×14 padding)
   - Progress dots at bottom edge — one per exercise, active = 20px wide
2. **Rest timer banner** (only while resting) — accent bg, spinner left, "REST" label + "0:47" (SF Rounded 20 tabular-nums), **+30s** + **Skip** pills
3. **Current exercise card** — icon square (44×44, move bg) + "EXERCISE 2 OF 5" eyebrow + big name (SF 22/700) + meta (*"Shoulders · Barbell · PR 57.5kg × 5"*)
4. **Set table** (inset card) — columns `[SET | TARGET | KG | REPS | ✓]`:
   - **SET** pill (28×28, numbered): done = move-green bg + white digit; active = accent bg + white digit; upcoming = `fill` bg + ink digit
   - **TARGET** SF Rounded ("50 × 6", ink3, tabular-nums)
   - **KG** / **REPS** SF Rounded 18/600 tabular-nums (green=done, ink=active, ink4=upcoming)
   - **Check** (28×28 rounded square): done = green filled w/ white ✓; active = accent-tinted w/ accent +; upcoming = fill w/ ink4 +
   - Row bg: done = `move @ 14%`; active = `accentTint`; upcoming = transparent
5. **Add set** button — dashed outline pill
6. **Up next** card — "UP NEXT" label + small icon + next exercise + target + chevron

**Interactions:**
- Tap check on active set → log weight/reps → advance → start rest timer (defaults to routine's rest, 2:00)
- Rest: haptic at 10s + 0s, auto-clears
- +30s extends, Skip dismisses
- Exercise ellipsis → swap exercise / add note
- Finish → confirm sheet → screen 10

**No tab bar** — focus mode.

---

### 10 · Post-Workout Summary

**Purpose:** Celebration + save.

**Layout:**
1. **Hero gradient** (move → accent diagonal) — "COMPLETE · PUSH DAY A" eyebrow, *"Nice session."* (SF 32/700), sub-line (*"You hit a new PR on bench."*), 3-col stat row: Time (52 min) / Volume (4,250 kg, tabular-nums) / PRs (1)
2. **Muscles worked** — pill chips (Chest, Shoulders, Triceps) + stacked horizontal bar + legend
3. **Exercises** — per exercise: name + optional PR badge (money orange) + total volume. Below: set chips (*"90×5"*, *"85×5"*, PR chip highlighted)
4. **Actions**: Share (outline, flex 1) + Save to timeline (filled move, flex 2)

**No tab bar.**

---

### 11 · Exercise Library

**Purpose:** Browse/search the exercise catalog. Opened from Routine Editor or as reference.

**Layout:**
- Nav: ← / "Exercises" (title) + "21 in library" (subtitle) / `+` trailing
- **Search** — fill-bg pill, magnifying glass + placeholder
- **Filter chips** (horizontal scroll): All / Push / Pull / Legs / Core / Cardio. Active = inverted (ink bg + bg text).
- **Grouped sections** (one per muscle group). Row: icon (36×36, group-tinted — push=green, pull=purple, legs=orange, core=blue, cardio=green) / name + "Chest · Barbell" meta / right side: PR value (SF Rounded 13/600 tabular-nums) + "PR" orange eyebrow / chevron

Exercise record: `{id, name, group, muscle, sf, equipment, pr: {weight, reps}}`.

---

### 12 · Workout Detail (past session)

**Purpose:** Replay of a completed session. Shown from timeline tap on a strength entry.

**Layout:**
- Nav: ← Today / routine name (title) + date (subtitle) / ellipsis
- **Summary tiles** (4-column inset): Duration (52m, move) / Volume (4.2t, accent) / Sets (17, rituals) / PRs (1, money). SF Rounded 20/700 value + caption.
- **Volume over 8 weeks** — mini bar chart (8 bars, last highlighted). Caption: *"Trend: ↑ 15% over 4 wks · Total 34.2t"*
- **Exercises** — per exercise, full set table. Header row (SF 10/700 uppercase): SET / KG / REPS / (PR). Data rows: SF Rounded 15/600 tabular-nums. PR badge on PR sets. Right subheader: "5 × 4,250kg".
- **Pal's note** card — accent-tinted, sparkle label, 1–2 sentences with a concrete next-session recommendation

---

### 13 · Rituals Tab

**Purpose:** Rituals landing. Enters from the Rituals tab.

**Layout:**
- Large-title nav "Rituals" + subtitle (current streak, e.g. *"11-day streak 🔥"*)
- **Today's rituals** — inset-grouped list of the user's 5 rituals. Row: icon (tinted 34×34) / title / cadence + streak ("Daily · 11d") / check button trailing (28×28 rounded; checked = purple filled w/ white ✓; unchecked = fill bg + ink3 circle outline). Tap toggles completion + haptic.
- **Progress** summary card — big "3 / 5 today" (SF Rounded 32/700) + horizontal progress bar (rituals-purple)
- **Manage rituals** button (outline) → Rituals Builder

---

### 14 · Monthly Review (AI-generated)

**Purpose:** End-of-month reflection. AI-written narrative + stats + discovered patterns.

**Layout:**
1. Month title (*"April"*) + "Monthly review" subtitle
2. **Narrative card** (gradient accent bg): "Written by Pal" sparkle label, 2–3 sentence LLM reflection, "Regenerate" pill
3. **By the numbers** — 4 big stat rows (Total spent / Time moved / Rituals kept / Streak)
4. **Patterns Pal found** — 3 insight rows with sparkle icon (*"Morning rituals lower food spending"*, *"Friday is your spendiest day"*, *"Movement and sleep are linked"*)

---

### 15 · You (profile)

**Purpose:** Profile + year stats + settings entry.

**Layout:**
- User avatar, name, *"Member since Jan 2024"*
- **This year** 2×2 grid: Total spent / Hours moved / Rituals kept / Longest streak
- **Settings** inset list:
  - Rituals → screen 13
  - Budgets & goals
  - Notifications
  - HealthKit connection
  - **Integrations → Email sync (Gmail · On)** → routes through screens 16/17/18 based on state
  - Privacy
  - Export data
  - About

---

### 16 · Email Sync · Intro (empty state)

**Purpose:** Unlinked-state value prop. Shown when no email account is connected.

**Layout:**
- Back to You + "Email sync" title
- **Hero illustration** — envelope icon square (72×72, accent-tinted, radius 20, accent envelope glyph)
- **Headline** — *"Let Pal read your receipts"* (SF Pro Display 24/700, text-wrap: pretty)
- **Body** — *"ExpensePal can scan your inbox for receipts and auto-categorize them. Your email stays on your device — we only import the lines that matter."* (SF 15 `ink2`)
- **Provider list** (inset grouped): Gmail / Outlook / Other (IMAP). Each: icon + name + "Recommended" pill on Gmail + chevron. Tap → screen 17.
- **How it works** — 3 bullet rows with sparkle icons: *"We read only sender-matched emails"*, *"Amounts + merchants parsed locally"*, *"Duplicates skipped automatically"*
- **Privacy footer** — *"Your app password is encrypted on-device. We never store inbox content."* (SF 12 `ink3`)

---

### 17 · Email Sync · Setup

**Purpose:** App-password credential flow. Not OAuth — user generates a Google/Outlook app password and pastes it here.

**Layout:**
- Back + "Connect Gmail" title
- **3-step instructions** card (inset): numbered rows
  1. *"Open Google app passwords"* → deep-link button (accent text + arrow-up-right)
  2. *"Create a password named 'ExpensePal'"*
  3. *"Paste the 16-character password below"*
- **Credentials form** (inset):
  - Email field (`hello@example.com` placeholder, keyboard = emailAddress)
  - App password field (16-char, monospace display, auto-formats "xxxx xxxx xxxx xxxx")
- **Advanced** (collapsible, chevron rotates) — IMAP server (`imap.gmail.com`) + Port (`993`) + SSL toggle (on by default)
- **Test connection** button (outline, full-width, 48px). States:
  - Idle: *"Test connection"*
  - Loading: spinner + *"Connecting…"*
  - Success: green ✓ + *"Connected to hello@example.com"* (button turns success-green)
  - Error: red × + error copy inline below
- **Save & sync** primary CTA (filled accent, 56px, radius 16) — **disabled until Test succeeds**
- Privacy footer reinforces local-encryption claim

**Interaction:** Pressing Save kicks off first sync and navigates to screen 18.

---

### 18 · Email Sync · Dashboard (synced)

**Purpose:** Connected state. Hero is the sync job + live progress + latest imports.

**Layout:**
1. Back + "Email sync" title + settings-gear trailing
2. **Connection chip** — `hello@example.com · Gmail` row with green pulse dot when syncing (bg: surface, radius 12, 12px padding, hair border)
3. **Sync job hero card** (inset):
   - Status line (SF 13/600 ink2) — cycles through *"Scanning INBOX · 1,847 messages"* → *"Filtering by sender · 62 matches"* → *"Pal categorized 3 · 1 duplicate skipped"* → *"Up to date · 2 min ago"*
   - Progress bar (4px tall, radius 2, accent fill, hair track; 100% = success-green briefly before fading to "Up to date")
   - **Sync now** button (filled accent pill, trailing spinner → ✓ on success) + **Every 15m** schedule chip (fill bg, chevron to change interval)
4. **Recent imports** list — most recent 10 receipts. Row: time (SF Mono) / merchant icon + name / category / amount (SF Rounded tabular-nums, money orange). Fresh entries (since last sync) show a **NEW** badge (money bg, white text, 10px uppercase) + accent-tinted row highlight that fades after 6s.
5. **Filters** button — opens sheet for sender allowlist / category mapping
6. **Disconnect account** (red destructive, centered, small)

---

## Design Tokens

### Colors — Light Mode

| Token | Hex | Use |
|---|---|---|
| `bg` | `#F2F2F7` | App background (iOS systemGroupedBackground) |
| `surface` | `#FFFFFF` | Cards, sheets, list rows |
| `surface2` | `#F2F2F7` | Secondary surfaces |
| `ink` | `#000000` | Primary text |
| `ink2` | `rgba(60,60,67,0.85)` | Secondary text |
| `ink3` | `rgba(60,60,67,0.60)` | Tertiary / captions |
| `ink4` | `rgba(60,60,67,0.30)` | Chevrons, disabled |
| `hair` | `rgba(60,60,67,0.12)` | Hairlines |
| `blur` | `rgba(242,242,247,0.72)` | Tab/nav bar blur |
| `fill` | `rgba(120,120,128,0.12)` | Segmented, chip, keypad key |
| `accent` | `#007AFF` | systemBlue — primary actions |
| `accentTint` | `rgba(0,122,255,0.14)` | Accent tinted bg |
| `money` | `#FF9500` | systemOrange — Spending |
| `moneyTint` | `rgba(255,149,0,0.14)` | |
| `move` | `#34C759` | systemGreen — Activity |
| `moveTint` | `rgba(52,199,89,0.14)` | |
| `rituals` | `#AF52DE` | systemPurple — Routine |
| `ritualsTint` | `rgba(175,82,222,0.14)` | |
| `red` | `#FF3B30` | Destructive |

### Colors — Dark Mode

| Token | Hex |
|---|---|
| `bg` | `#000000` |
| `surface` | `#1C1C1E` |
| `surface2` | `#2C2C2E` |
| `ink` | `#FFFFFF` |
| `ink2` | `rgba(235,235,245,0.85)` |
| `ink3` | `rgba(235,235,245,0.60)` |
| `ink4` | `rgba(235,235,245,0.30)` |
| `hair` | `rgba(84,84,88,0.65)` |
| `blur` | `rgba(0,0,0,0.72)` |
| `fill` | `rgba(120,120,128,0.24)` |
| `accent` | `#0A84FF` |
| `money` | `#FF9F0A` |
| `move` | `#30D158` |
| `rituals` | `#BF5AF2` |
| `red` | `#FF453A` |

### Accent options (user-selectable)

Blue `#007AFF` · Indigo `#5856D6` · Purple `#AF52DE` · Pink `#FF2D55` · Orange `#FF9500` · Green `#34C759` · Teal `#30B0C7` · Graphite `#1C1C1E`.

Dark variants: Indigo `#5E5CE6` · Purple `#BF5AF2` · Pink `#FF375F` · Orange `#FF9F0A` · Green `#30D158` · Teal `#40C8E0` · Graphite `#F5F5F7`.

Persist selection in `@AppStorage("accent")`.

### Typography

SF Pro family (system default on iOS):

| Style | Font | Size | Weight | Tracking |
|---|---|---|---|---|
| Large title | SF Pro Display | 34 | 700 | -0.4 |
| Title 1 | SF Pro Display | 28 | 700 | -0.5 |
| Title 2 | SF Pro Display | 22 | 700 | -0.35 |
| Title 3 | SF Pro Display | 20 | 600 | -0.3 |
| Headline | SF Pro Text | 17 | 600 | -0.43 |
| Body | SF Pro Text | 17 | 400 | -0.43 |
| Callout | SF Pro Text | 16 | 400 | -0.31 |
| Subheadline | SF Pro Text | 15 | 400 | -0.24 |
| Footnote | SF Pro Text | 13 | 400 | -0.08 |
| Caption 1 | SF Pro Text | 12 | 400 | 0 |
| Caption 2 | SF Pro Text | 11 | 400 | 0.06 |

**Numerals (amounts, counts, time):** SF Pro Rounded at display sizes (≥20), `fontVariantNumeric: 'tabular-nums'`. In SwiftUI: `.monospacedDigit()` + `.fontDesign(.rounded)`.

**Mono (timestamps, eyebrows):** SF Mono, 11–13px, often uppercase with +0.5 tracking.

### Spacing

8-pt grid. Common values: 4, 8, 12, 16, 20, 24, 32, 48. Screen horizontal padding: **16px**. Inset grouped sections: **16px** outside + **16px** inside.

### Radii

| Use | Radius |
|---|---|
| Big cards (rings hero, gradient heros) | 20 |
| Inset grouped sections | 10 |
| Sheets | 14 (top only) |
| Icon squares | 8–10 (~28% of size) |
| Pill buttons | 100 |
| Chip | 8–12 |
| CTA button | 14–16 |

### Shadows

Used sparingly. Most surfaces rely on `0.5px` hairlines instead.

- **FAB:** `0 6px 20px rgba(0,0,0,0.18), 0 0 0 0.5px rgba(0,0,0,0.05)`
- **Popover / Tweaks panel:** `0 12px 48px rgba(0,0,0,0.20), 0 0 0 0.5px rgba(0,0,0,0.08)`

### Iconography

All icons are **SF Symbols** — reference by name in SwiftUI (`Image(systemName: "flame.fill")`). Names used in the design:

`flame.fill`, `dollarsign.circle.fill`, `sparkles`, `figure.run`, `figure.walk`, `dumbbell.fill`, `book.closed.fill`, `books.vertical.fill`, `character.book.closed.fill`, `tray.fill`, `cup.and.saucer.fill`, `fork.knife`, `basket.fill`, `plus`, `chevron.left`, `chevron.right`, `chevron.up`, `chevron.down`, `ellipsis`, `bell.fill`, `heart.fill`, `target`, `gearshape.fill`, `person.crop.circle.fill`, `calendar`, `chart.bar.fill`, `envelope.fill`, `paperplane.fill`, `checkmark`, `xmark`, `arrow.up.right`, `lock.fill`, `clock.fill`.

---

## Component specs

### Activity Rings (hero on Today)
- 3 concentric rings, ~180px outer diameter
- Money = outer (24px stroke, orange), Move = middle (22px, green), Rituals = inner (20px, purple)
- Progress = angle 0 → 360° clockwise from 12 o'clock
- Track bg = ring color @ 18% alpha
- Line cap: round
- On appearance: animate 0 → current over 800ms ease-out, staggered 60ms per ring

### Tab bar
- 84pt tall (including safe area)
- Blurred (`backdrop-filter: blur(24px) saturate(180%)`), semi-transparent `theme.blur` bg
- 0.5px top border (`theme.hair`)
- **5 slots** — Today (house.fill) / Move (figure.run) / **FAB** (+ center, 54×54, accent bg, raised) / Rituals (sparkles) / You (person.crop.circle.fill)
- Non-active icons `theme.ink3`; active `theme.accent`
- Labels 10px, SF Pro Text 500, under icon

### Large-title nav bar
- Collapsed 44pt, expanded 96pt
- Title SF Pro Display 34/700 expanded; 17/600 collapsed (centered)
- Trailing icon buttons: 32×32 circle, `theme.fill` bg, accent symbol 17pt
- Subtitle (optional): SF 13/500 `theme.ink3`, below title when expanded

### Inset grouped list section
- Header: SF 13/600 `theme.ink3`, uppercase, 16px horizontal pad, 8px bottom gap
- Card: `theme.surface`, radius 10, 16px horizontal margin
- Row: 44pt min height, 16px horizontal padding, icon + title + right value + chevron
- Hairlines between rows only (not at top/bottom of card)
- Footer: SF 12 `theme.ink3`, 8px top gap, 16px horizontal pad

### List row (default)
```
[icon 28×28 r=8 tint bg + white glyph] [title 16/500 · subtitle 13 ink3]     [value 15 SF Rounded tabular-nums] [chevron 14 ink4]
```

### Progress bar (sync, budget, rituals)
- Track 4px, radius 2, bg `theme.fill`
- Fill same height, accent color (or type color), animates on value change 240ms ease-out

### Ritual / set check button
- 28×28 rounded square, radius 8
- States: idle (fill bg + ink3 stroke) / completed (type-color filled + white ✓) / active (accent-tinted + accent glyph)
- Tap: scale 0.9 for 60ms, haptic light-impact, transition to completed over 180ms

---

## AI Prompts

### Ask Pal — system/context prompt
Prepend to every `/chat` call. Substitute user data at call time.

```
You are Pal, a gentle, concise coach in an iOS app that tracks money, movement and daily rituals.

Today's entries for {userName}:
{entries formatted as: HH:MM Title (type, detail)}

Daily budget ${X}, move goal {Y}min, ritual goal {Z}.
Spent ${A} so far, moved {B}min, {C}/{Z} rituals done.

Week: ${D} of ${E} spent, {F}min moved, {G}/{H} rituals. {I}-day move streak.

Reply in 1-3 short sentences. Friendly, specific, no filler. Never say "amazing" or "great job" — be observational and warm instead.
```

### Monthly Review — generation prompt (`/review`)
```
Write a 2-3 sentence warm, specific, editorial reflection on this month's tracking data. Avoid hype words like "amazing" or "crushed it". Be specific and observational.

Data: ${spent} spent (down {X}% vs last month), {hours}h moved (up {Y}%), {activeDays} active days, {ritualsKept}/{ritualsTarget} rituals kept ({pct}%). Current {streak}-day move streak. Top category: {topCat} {topPct}%. Pattern: {discoveredPattern}.
```

### Natural-language entry parsing (`/parse`)
```
Parse this free-form log into JSON. User said: "{input}"
Return strictly: {"type": "money|move|rituals", "amount": number|null, "duration": number|null, "category": string|null, "title": string, "note": string|null}
No prose. If ambiguous, guess from context.
```

### Workout suggestion — used by screen 08 Pal's pick card
```
The user logged these workouts this week:
{routineName — date — muscles worked}

Today is {dayOfWeek}. Pick ONE routine from {availableRoutines} that balances their recent volume. Return strictly:
{"routineId": string, "reason": "one sentence, specific, observational"}
```

### Post-workout note — used by screen 12 Pal's note
```
User just finished {routineName}: {N} sets, {volume}kg total, {prCount} PRs on {prExercises}. Their last session of the same routine was {N}kg, {daysAgo} days ago.

Write 1-2 sentences observing the trend and recommending one concrete change next session (e.g. add 2.5kg, add a set, drop weight and focus on form). Warm, specific, no hype.
```

---

## Interactions & Behavior

| Interaction | Spec |
|---|---|
| Sheet present | Slide up 280ms ease-out, backdrop fades in 160ms |
| Nav push | Standard iOS, 300ms |
| Tab switch | No animation (optional content crossfade 120ms) |
| Button press | Scale 0.97 for 80ms, release back |
| FAB press | Scale 0.92 for 80ms + haptic light-impact |
| Row tap | Brief highlight `theme.fill` 180ms fade |
| Pull-to-refresh | Standard iOS; refreshes HealthKit + kicks email sync if due |
| Long-press entry | Haptic medium, context menu (Edit / Duplicate / Delete) |
| Drag-reorder (rituals, routine ex.) | Standard iOS reorder handles |
| Swipe-to-delete | Standard iOS trailing action, red destructive |
| Activity ring animation | On Today appear, 0 → current 800ms ease-out, 60ms staggered |
| LLM loading | 3 pulsing dots in assistant bubble; fade-in response on arrival |
| Rest timer tick | SF Rounded value updates every 200ms; haptic at 10s and 0s |
| Sync progress | Status line cross-fades 200ms between stages; progress bar tweens value 300ms ease-out; completion flashes green 800ms before returning to track color |
| NEW badge on synced row | Accent-tint row bg fades over 6s after appearance; badge persists until row is tapped or dismissed |

---

## State Management

**App-level:**
- `entries: [Entry]` — queried by date range
- `workouts: [Workout]` — with nested `sets`
- `routines: [Routine]`
- `rituals: [Ritual]`
- `goals: Goals`
- `emailAccount: EmailAccount?`
- `todayRings: {money, move, rituals}` — computed from today's entries

**Derived:**
- Day/week/month aggregates — on demand via SwiftData queries
- Streaks — recompute when entries change
- PRs — recompute on workout save (compare max `weight × reps` per exercise against history)
- Category breakdowns — derive from money entries
- Muscles worked — derive from exercise metadata

**Ephemeral (active session):**
- `activeWorkout: Workout?` — present only during screen 09
- `restTimer: {remaining: Int, defaultSec: Int}`
- `currentExerciseIndex: Int`
- `currentSetIndex: Int`

**Chat (Ask Pal):**
- `messages: [Message]` — reset per session (persist opt-in)
- `isLoading: Bool`

**Email sync:**
- `syncStatus: .idle | .scanning | .filtering | .categorizing | .upToDate | .error(String)`
- `syncProgress: Double` (0…1)
- `lastSyncedAt: Date?`
- `newEntriesSinceLastSync: Set<UUID>` — drives NEW badge

---

## Copy / Microcopy (use verbatim)

- Onboarding CTAs: *"Get started"*, *"Continue"*, *"Start tracking"*
- New entry segments: *"Expense"*, *"Workout"*, *"Ritual"*
- Empty Today: *"Nothing logged yet. Tap + to start your day."*
- Empty Ask Pal: *"Hi {name}. I'm Pal — ask me anything about your money, movement, or rituals. Or just tell me what you did and I'll log it."*
- Suggestion chips: *"Why was Friday expensive?"*, *"How am I doing this week?"*, *"Suggest an evening ritual"*
- Monthly review label: *"Written by Pal"*
- Regenerate button: *"Regenerate"*
- Rituals footer: *"Drag to reorder · swipe to remove"*
- Evening reflection: 2–3 sentences, warm/observational, never hype
- Workout Finish confirm: *"Finish workout?"* / body: *"You'll save {N} sets and {volume}kg of volume."* / buttons: *"Keep going"* / *"Finish & save"*
- Email intro headline: *"Let Pal read your receipts"*
- Email privacy footer: *"Your app password is encrypted on-device. We never store inbox content."*
- Email sync status: *"Scanning INBOX · {N} messages"* → *"Filtering by sender · {N} matches"* → *"Pal categorized {N} · {M} duplicates skipped"* → *"Up to date · {time}"*

---

## Files in this bundle

- `ExpensePal.html` — Entry point: canvas, Tweaks panel, device frames
- `src/tokens.jsx` — Design tokens (colors, type, accent options, mock data)
- `src/components.jsx` — Shared: NavBar, Section, ListRow, TabBar, Segmented, ActivityRings
- `src/icons.jsx` — SF Symbols → SVG mapping (for web prototype only; use native symbols in app)
- `src/ios-frame.jsx` — iPhone frame (canvas only, skip in real app)
- `src/today.jsx` — Screens 02, 03, 04 (Today, Quick Actions overlay, New Entry sheet)
- `src/screens.jsx` — Screens 06, 15 (Spending Detail, You)
- `src/ai-screens.jsx` — Screens 01, 05, 14 (Onboarding, Ask Pal, Monthly Review)
- `src/tab-landings.jsx` — Screens 07, 13 (Move Tab, Rituals Tab)
- `src/workout-screens.jsx` — Screens 08, 09 (Start Workout, Active Session)
- `src/workout-screens2.jsx` — Screens 10, 11, 12 (Post-Workout, Exercise Library, Workout Detail)
- `src/workout-data.jsx` — Routines, exercises, PRs mock data
- `src/email-sync.jsx` — Screens 16, 17, 18 (Email Intro, Setup, Dashboard)

Open `ExpensePal.html` in a browser to see all 18 screens rendered live in a 6×3 canvas. Pan/zoom/focus any screen for pixel reference.

---

## Assets

- **Icons:** All SF Symbols. In SwiftUI: `Image(systemName: "flame.fill")`. No icon asset export needed.
- **Fonts:** System (SF Pro Display / Text / Rounded / Mono). Use `Font.system(size:, weight:, design:)`.
- **Images:** None. All visuals are shapes + SF Symbols + Swift Charts.
- **Haptics:** `UIImpactFeedbackGenerator` light (buttons, check), medium (long-press menus), success (PR, sync complete).

---

## Recommended build order

1. **Design tokens** (`Color` and `Font` extensions) — match light/dark + all 8 accents
2. **Shared components** (`NavBar`, `InsetSection`, `ListRow`, `TabBar`, `SummaryTile`, `ActivityRings`, `ProgressBar`, `CheckButton`)
3. **Today screen** — static data first, then wire SwiftData
4. **New Entry sheet** — segmented + custom keypad + quick-picks
5. **Tab bar + FAB** — wire navigation between tabs
6. **Move tab + Rituals tab** — landings and detail screens
7. **Workout flow** — Start Workout → Active Session (the hard one: rest timer, set logging, PR detection) → Post-Workout
8. **Routine Editor + Exercise Library + Workout Detail**
9. **LLM proxy server** — deploy `/chat`, `/review`, `/parse` endpoints
10. **Ask Pal + Monthly Review + Pal's Picks** — wire LLM calls, handle loading/errors
11. **Onboarding** — first-run gate on `Goals` presence
12. **HealthKit import** — autofill move entries
13. **Email sync** — server worker + IMAP client + Intro/Setup/Dashboard screens + push notifications on completion
14. **Polish** — haptics, animation timing, empty states, error states, accessibility labels
