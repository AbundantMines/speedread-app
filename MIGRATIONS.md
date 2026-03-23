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
