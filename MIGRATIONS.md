# Phase 2 Schema Migrations (2026-03-29)

## D1 Database (warpreader-analytics): referrals table
Run in Cloudflare D1 console (DB ID: 855d0ea9-f72a-44d6-aa5c-6159d1576062):

```sql
CREATE TABLE IF NOT EXISTS referrals (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  referrer_email TEXT NOT NULL,
  referred_email TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  redeemed INTEGER DEFAULT 0,
  redeemed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_email);
CREATE INDEX IF NOT EXISTS idx_referrals_referred ON referrals(referred_email);
```

---

# Phase 1 Schema Migrations (applied 2026-03-22)

## profiles table additions
- streak_current int DEFAULT 0
- streak_best int DEFAULT 0
- last_session_date date
- wpm_current int DEFAULT 0
- wpm_peak int DEFAULT 0
- xp_total int DEFAULT 0
- level int DEFAULT 1
- books_finished int DEFAULT 0
- total_words_read bigint DEFAULT 0
- total_sessions int DEFAULT 0
- course_started_at timestamptz
- course_day_completed int DEFAULT 0
- course_completed_at timestamptz

## New tables
- documents (user library with RLS)
- comprehension_results (quiz scores with RLS)
