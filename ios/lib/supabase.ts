import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

const SUPABASE_URL = 'https://hmacjbgnvljhgvwdzkds.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhtYWNqYmdudmxqaGd2d2R6a2RzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4MDcwODAsImV4cCI6MjA4OTM4MzA4MH0.crS-Y4zEnCmUPM7DBbJvb5nVufgtbEXyW6WpOSBTl2k';

// Custom SecureStore adapter for Supabase auth persistence
const ExpoSecureStoreAdapter = {
  getItem: (key: string) => {
    return SecureStore.getItemAsync(key);
  },
  setItem: (key: string, value: string) => {
    SecureStore.setItemAsync(key, value);
  },
  removeItem: (key: string) => {
    SecureStore.deleteItemAsync(key);
  },
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Database types
export interface SavedDocument {
  id: string;
  user_id: string;
  title: string;
  content: string;
  word_count: number;
  source_url?: string;
  created_at: string;
  last_read_at?: string;
  reading_progress?: number; // 0-1
}

export interface ReadingSession {
  id: string;
  user_id: string;
  document_id?: string;
  document_title: string;
  wpm: number;
  words_read: number;
  duration_seconds: number;
  completed: boolean;
  created_at: string;
}

export interface UserProfile {
  id: string;
  email: string;
  plan: 'free' | 'pro';
  default_wpm: number;
  docs_today: number;
  streak: number;
  last_read_date?: string;
  created_at: string;
}
