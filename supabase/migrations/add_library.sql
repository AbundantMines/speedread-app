-- Library tables for WarpReader document library + reading streaks
-- Run against your Supabase project

-- Documents table (may already exist from cloud sync — use IF NOT EXISTS)
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  format TEXT,
  content TEXT,
  position INTEGER DEFAULT 0,
  total_words INTEGER DEFAULT 0,
  progress REAL DEFAULT 0,
  added_at TIMESTAMPTZ DEFAULT now(),
  last_read_at TIMESTAMPTZ,
  UNIQUE(user_id, title)
);

-- Reading sessions (may already exist — safe with IF NOT EXISTS)
CREATE TABLE IF NOT EXISTS reading_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ DEFAULT now(),
  ended_at TIMESTAMPTZ,
  words_read INTEGER DEFAULT 0,
  avg_wpm INTEGER DEFAULT 0
);

-- Reading streaks
CREATE TABLE IF NOT EXISTS reading_streaks (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  last_read_date DATE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_documents_user ON documents(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON reading_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_document ON reading_sessions(document_id);
