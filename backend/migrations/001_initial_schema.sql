-- SpeedRead — Initial Schema
-- Run this in Supabase SQL Editor after creating your project

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ─── USERS ───────────────────────────────────────────────────
-- Extends Supabase auth.users with app-specific data
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text,
  full_name text,
  avatar_url text,
  plan text not null default 'free', -- 'free' | 'pro' | 'lifetime' | 'team'
  stripe_customer_id text unique,
  stripe_subscription_id text,
  subscription_status text, -- 'active' | 'canceled' | 'past_due'
  subscription_ends_at timestamptz,
  -- Usage tracking
  docs_read_today integer not null default 0,
  docs_date date not null default current_date,
  total_words_read bigint not null default 0,
  total_sessions integer not null default 0,
  -- Settings
  default_wpm integer not null default 300,
  theme text not null default 'dark',
  font_size integer not null default 42,
  -- Metadata
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Reset daily doc count when date changes
create or replace function public.reset_daily_usage()
returns trigger as $$
begin
  if new.docs_date < current_date then
    new.docs_read_today := 0;
    new.docs_date := current_date;
  end if;
  return new;
end;
$$ language plpgsql;

create trigger reset_daily_usage_trigger
  before update on public.profiles
  for each row execute procedure public.reset_daily_usage();

-- ─── READING SESSIONS ────────────────────────────────────────
create table public.reading_sessions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  -- Document info
  doc_title text,
  doc_source text, -- 'paste' | 'pdf' | 'url' | 'epub'
  doc_url text,
  word_count integer not null default 0,
  -- Performance
  wpm integer not null,
  duration_seconds integer not null,
  completed boolean not null default false,
  percent_completed integer not null default 0,
  -- Comprehension (AI)
  comprehension_score integer, -- 0-100
  comprehension_questions jsonb, -- [{question, options, correct, chosen}]
  -- Metadata
  created_at timestamptz not null default now()
);

-- Index for fast user queries
create index idx_reading_sessions_user_id on public.reading_sessions(user_id);
create index idx_reading_sessions_created_at on public.reading_sessions(created_at desc);

-- ─── DOCUMENTS (saved library) ───────────────────────────────
create table public.saved_documents (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  title text not null,
  content text not null, -- full text
  source text, -- 'paste' | 'pdf' | 'url'
  source_url text,
  word_count integer,
  last_position integer default 0, -- word index for resume
  last_wpm integer,
  is_favorite boolean default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_saved_documents_user_id on public.saved_documents(user_id);

-- ─── ROW LEVEL SECURITY ──────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.reading_sessions enable row level security;
alter table public.saved_documents enable row level security;

-- Profiles: users can only see/edit their own
create policy "Users can view own profile"
  on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

-- Reading sessions: users can only see/create their own
create policy "Users can view own sessions"
  on public.reading_sessions for select using (auth.uid() = user_id);
create policy "Users can create own sessions"
  on public.reading_sessions for insert with check (auth.uid() = user_id);

-- Saved documents: users can only CRUD their own
create policy "Users can view own documents"
  on public.saved_documents for select using (auth.uid() = user_id);
create policy "Users can create own documents"
  on public.saved_documents for insert with check (auth.uid() = user_id);
create policy "Users can update own documents"
  on public.saved_documents for update using (auth.uid() = user_id);
create policy "Users can delete own documents"
  on public.saved_documents for delete using (auth.uid() = user_id);

-- ─── HELPER FUNCTIONS ────────────────────────────────────────

-- Get user plan (used by billing webhook)
create or replace function public.upgrade_user_plan(
  p_user_id uuid,
  p_plan text,
  p_stripe_customer_id text,
  p_stripe_subscription_id text,
  p_subscription_status text,
  p_subscription_ends_at timestamptz default null
) returns void as $$
begin
  update public.profiles
  set
    plan = p_plan,
    stripe_customer_id = p_stripe_customer_id,
    stripe_subscription_id = p_stripe_subscription_id,
    subscription_status = p_subscription_status,
    subscription_ends_at = p_subscription_ends_at,
    updated_at = now()
  where id = p_user_id;
end;
$$ language plpgsql security definer;
