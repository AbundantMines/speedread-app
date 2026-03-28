# Warpreader iOS App

React Native (Expo SDK 53) mobile app for [Warpreader](https://warpreader.com) — a speed reading app using RSVP technology.

## Setup

```bash
cd ios
npm install
npx expo start
```

### Additional dependency needed in package.json

The reader uses `@react-native-community/slider` — add it:

```bash
npx expo install @react-native-community/slider
```

## Architecture

### Screens

| Screen | Path | Description |
|---|---|---|
| Onboarding | `app/onboarding.tsx` | 3-slide intro with live RSVP demo animation, shown once on first launch |
| Auth | `app/auth.tsx` | Email/password login + signup via Supabase, guest mode (3 docs/day) |
| Home | `app/(tabs)/index.tsx` | Hero card, recent docs, mini WPM chart, import actions (paste/file/URL/library) |
| Reader | `app/reader.tsx` | Full-screen RSVP reader — play/pause, speed slider, swipe gestures, completion stats |
| Library | `app/(tabs)/library.tsx` | Project Gutenberg search + category browsing, book download, "My Books" shelf |
| Progress | `app/(tabs)/progress.tsx` | WPM line chart, streak calendar heatmap, level/badge system, reading stats |
| Profile | `app/(tabs)/profile.tsx` | Account info, plan badge, WPM/font settings, dark mode toggle, upgrade CTA, sign out |

### Core Components

| Component | Description |
|---|---|
| `RSVPWord` | Renders a word split at ORP — before text, gold ORP letter, after text — with fade+scale animation |
| `WPMChart` | SVG line chart with gradient fill, responsive, supports mini mode for home card |
| `BookCard` | Gutenberg book card with gold spine, author, subject tag, download state |
| `StatsCard` | `CompletionStats` (full overlay) + `PauseStats` (inline HUD) |
| `StreakCalendar` | GitHub-style contribution heatmap for reading streaks |

### Core Libraries

| File | Description |
|---|---|
| `lib/rsvp.ts` | RSVP engine: ORP calculation, smart delay with punctuation pauses, word tokenizer, WPM percentile |
| `lib/supabase.ts` | Supabase client with SecureStore adapter for persistent auth |
| `lib/storage.ts` | AsyncStorage helpers: documents, sessions, WPM history, settings, streak calculation |
| `lib/api.ts` | WPM API, Gutenberg/Gutendex search, article text extraction, Pro checkout URLs |

### Hooks

| Hook | Description |
|---|---|
| `useAuth` | Auth state + signIn/signUp/signOut/resetPassword/continueAsGuest |
| `useRSVP` | Full RSVP playback engine: play/pause/toggle/skip/changeWpm with timer management |
| `useSync` | Bidirectional Supabase sync for documents and reading sessions |

## RSVP Engine

The ORP (Optimal Recognition Point) system:

```
Word: "reading"
ORP index: 2 (for 7-char word)
Display: re[a]ding (gold 'a')
```

Smart delay multipliers:
- `.!?` sentence end → 2.8x pause
- `,;:` clause break → 1.6x  
- `>10 chars` long word → 1.3x
- `≤2 chars` short word → 0.7x
- Minimum delay: 50ms

## Design System

```
Background:   #0a0a0a
Cards:        #111111  
Elevated:     #1a1a1a
Gold accent:  #c9a84c
Text:         #e8e0d0
Muted:        #8a8070
Border:       #2a2a2a
```

## Data Flow

1. Documents stored locally in AsyncStorage (offline-first)
2. Auth tokens persisted in SecureStore
3. On focus: sync unsynced docs/sessions → Supabase
4. Guest users: tracked via AsyncStorage date check (resets daily)
5. WPM history posted to `warpreader.com/api/wpm` on session complete

## Pro Gating

- Free/Guest: 3 documents/day limit (tracked in AsyncStorage)
- Pro: unlimited, cloud sync, full library
- Upgrade: opens `warpreader.com/checkout?source=ios` in browser
- RevenueCat placeholder ready in `lib/api.ts` for native IAP

## Bundle ID

`com.warpreader.app`
