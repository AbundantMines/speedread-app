import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  ONBOARDING_DONE: 'onboarding_done',
  GUEST_DOCS_TODAY: 'guest_docs_today',
  GUEST_DOCS_DATE: 'guest_docs_date',
  READING_SESSIONS: 'reading_sessions',
  SAVED_DOCUMENTS: 'saved_documents',
  WPM_HISTORY: 'wpm_history',
  USER_SETTINGS: 'user_settings',
  PENDING_SYNC: 'pending_sync',
};

export interface UserSettings {
  defaultWpm: number;
  fontSize: number;
  darkMode: boolean;
  fontFamily: string;
}

export const DEFAULT_SETTINGS: UserSettings = {
  defaultWpm: 250,
  fontSize: 42,
  darkMode: true,
  fontFamily: 'System',
};

export interface LocalDocument {
  id: string;
  title: string;
  content: string;
  wordCount: number;
  sourceUrl?: string;
  createdAt: string;
  lastReadAt?: string;
  readingProgress: number; // 0-1
  synced: boolean;
}

export interface LocalReadingSession {
  id: string;
  documentId?: string;
  documentTitle: string;
  wpm: number;
  wordsRead: number;
  durationSeconds: number;
  completed: boolean;
  createdAt: string;
  synced: boolean;
}

export interface WpmEntry {
  wpm: number;
  date: string; // ISO string
  documentTitle?: string;
}

// --- Onboarding ---
export async function hasSeenOnboarding(): Promise<boolean> {
  const val = await AsyncStorage.getItem(KEYS.ONBOARDING_DONE);
  return val === 'true';
}

export async function markOnboardingDone(): Promise<void> {
  await AsyncStorage.setItem(KEYS.ONBOARDING_DONE, 'true');
}

// --- Guest doc limits ---
export async function getGuestDocsToday(): Promise<number> {
  const date = await AsyncStorage.getItem(KEYS.GUEST_DOCS_DATE);
  const today = new Date().toDateString();
  if (date !== today) {
    await AsyncStorage.setItem(KEYS.GUEST_DOCS_DATE, today);
    await AsyncStorage.setItem(KEYS.GUEST_DOCS_TODAY, '0');
    return 0;
  }
  const count = await AsyncStorage.getItem(KEYS.GUEST_DOCS_TODAY);
  return parseInt(count || '0', 10);
}

export async function incrementGuestDocs(): Promise<void> {
  const count = await getGuestDocsToday();
  await AsyncStorage.setItem(KEYS.GUEST_DOCS_TODAY, String(count + 1));
}

// --- User Settings ---
export async function getUserSettings(): Promise<UserSettings> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.USER_SETTINGS);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveUserSettings(settings: Partial<UserSettings>): Promise<void> {
  const current = await getUserSettings();
  await AsyncStorage.setItem(
    KEYS.USER_SETTINGS,
    JSON.stringify({ ...current, ...settings })
  );
}

// --- Documents ---
export async function getSavedDocuments(): Promise<LocalDocument[]> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.SAVED_DOCUMENTS);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export async function saveDocument(doc: LocalDocument): Promise<void> {
  const docs = await getSavedDocuments();
  const idx = docs.findIndex((d) => d.id === doc.id);
  if (idx >= 0) {
    docs[idx] = doc;
  } else {
    docs.unshift(doc);
  }
  await AsyncStorage.setItem(KEYS.SAVED_DOCUMENTS, JSON.stringify(docs));
}

export async function deleteDocument(id: string): Promise<void> {
  const docs = await getSavedDocuments();
  const filtered = docs.filter((d) => d.id !== id);
  await AsyncStorage.setItem(KEYS.SAVED_DOCUMENTS, JSON.stringify(filtered));
}

export async function updateDocumentProgress(id: string, progress: number): Promise<void> {
  const docs = await getSavedDocuments();
  const doc = docs.find((d) => d.id === id);
  if (doc) {
    doc.readingProgress = progress;
    doc.lastReadAt = new Date().toISOString();
    await AsyncStorage.setItem(KEYS.SAVED_DOCUMENTS, JSON.stringify(docs));
  }
}

// --- Reading Sessions ---
export async function getReadingSessions(): Promise<LocalReadingSession[]> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.READING_SESSIONS);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export async function saveReadingSession(session: LocalReadingSession): Promise<void> {
  const sessions = await getReadingSessions();
  sessions.unshift(session);
  // Keep last 200 sessions
  const trimmed = sessions.slice(0, 200);
  await AsyncStorage.setItem(KEYS.READING_SESSIONS, JSON.stringify(trimmed));
}

// --- WPM History ---
export async function getWpmHistory(): Promise<WpmEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.WPM_HISTORY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export async function addWpmEntry(entry: WpmEntry): Promise<void> {
  const history = await getWpmHistory();
  history.unshift(entry);
  const trimmed = history.slice(0, 100);
  await AsyncStorage.setItem(KEYS.WPM_HISTORY, JSON.stringify(trimmed));
}

// --- Streak calculation ---
export function calculateStreak(sessions: LocalReadingSession[]): number {
  if (sessions.length === 0) return 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const sessionDates = new Set(
    sessions.map((s) => {
      const d = new Date(s.createdAt);
      d.setHours(0, 0, 0, 0);
      return d.getTime();
    })
  );

  let streak = 0;
  let current = today.getTime();

  while (sessionDates.has(current)) {
    streak++;
    current -= 86400000; // minus one day
  }

  return streak;
}

// --- Pending sync queue ---
export async function getPendingSync(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.PENDING_SYNC);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export async function addPendingSync(sessionId: string): Promise<void> {
  const pending = await getPendingSync();
  if (!pending.includes(sessionId)) {
    pending.push(sessionId);
    await AsyncStorage.setItem(KEYS.PENDING_SYNC, JSON.stringify(pending));
  }
}

export async function removePendingSync(sessionId: string): Promise<void> {
  const pending = await getPendingSync();
  const filtered = pending.filter((id) => id !== sessionId);
  await AsyncStorage.setItem(KEYS.PENDING_SYNC, JSON.stringify(filtered));
}
