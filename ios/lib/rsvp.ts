// RSVP Engine — ported from WarpReader web app

// ORP (Optimal Recognition Point) lookup table
// Index = character count of the word (capped at 15)
const ORP_TABLE = [0, 0, 0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 4];

/**
 * Get the Optimal Recognition Point index for a word.
 * This is the position of the letter that should be highlighted/centered.
 */
export function getORP(word: string): number {
  const clean = word.replace(/[^a-zA-Z0-9]/g, '');
  const len = Math.min(clean.length, ORP_TABLE.length - 1);
  return ORP_TABLE[len];
}

/**
 * Calculate display delay for a word at a given WPM.
 * Adds pauses for punctuation and slows down for long words.
 */
export function getDelay(word: string, wpm: number): number {
  const base = 60000 / wpm;
  let mult = 1;

  if (/[.!?]$/.test(word)) {
    mult = 2.8; // sentence end — big pause
  } else if (/[,;:]/.test(word)) {
    mult = 1.6; // clause break — medium pause
  } else if (word.length > 10) {
    mult = 1.3; // long word — slight slowdown
  } else if (word.length <= 2) {
    mult = 0.7; // short word — speed up
  }

  return Math.max(base * mult, 50); // never faster than 50ms
}

/**
 * Split text into an array of words, filtering empty strings.
 */
export function tokenizeText(text: string): string[] {
  return text
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 0);
}

/**
 * Split a word into three parts based on ORP:
 * - before: characters before the ORP letter
 * - orpChar: the ORP letter (highlighted in gold)
 * - after: characters after the ORP letter
 */
export interface WordParts {
  before: string;
  orpChar: string;
  after: string;
}

export function splitWordAtORP(word: string): WordParts {
  const orpIndex = getORP(word);

  if (word.length === 0) {
    return { before: '', orpChar: ' ', after: '' };
  }

  const before = word.slice(0, orpIndex);
  const orpChar = word[orpIndex] || word[0];
  const after = word.slice(orpIndex + 1);

  return { before, orpChar, after };
}

/**
 * Estimate reading time for a text at given WPM.
 * Returns seconds.
 */
export function estimateReadingTime(text: string, wpm: number): number {
  const words = tokenizeText(text);
  return Math.ceil((words.length / wpm) * 60);
}

/**
 * Calculate estimated time remaining.
 * Returns formatted string like "2m 30s"
 */
export function formatTimeRemaining(wordsLeft: number, wpm: number): string {
  const seconds = Math.ceil((wordsLeft / wpm) * 60);
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
}

/**
 * Format a duration in seconds to a human-readable string.
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
}

/**
 * Get reading level/badge based on WPM.
 */
export type ReadingLevel = {
  label: string;
  emoji: string;
  minWpm: number;
  maxWpm: number;
};

export const READING_LEVELS: ReadingLevel[] = [
  { label: 'Novice', emoji: '📖', minWpm: 0, maxWpm: 150 },
  { label: 'Reader', emoji: '📚', minWpm: 150, maxWpm: 250 },
  { label: 'Proficient', emoji: '⚡', minWpm: 250, maxWpm: 400 },
  { label: 'Advanced', emoji: '🚀', minWpm: 400, maxWpm: 600 },
  { label: 'Expert', emoji: '🎯', minWpm: 600, maxWpm: 900 },
  { label: 'Speed Demon', emoji: '🔥', minWpm: 900, maxWpm: Infinity },
];

export function getReadingLevel(wpm: number): ReadingLevel {
  return (
    READING_LEVELS.find((l) => wpm >= l.minWpm && wpm < l.maxWpm) ||
    READING_LEVELS[0]
  );
}

/**
 * Calculate WPM percentile (approximate).
 * Average adult reads ~238 WPM.
 */
export function getWpmPercentile(wpm: number): number {
  // Rough normal distribution around mean=238, std=80
  const mean = 238;
  const std = 80;
  const z = (wpm - mean) / std;
  // Approximate CDF
  const percentile = Math.round(
    (0.5 * (1 + erf(z / Math.sqrt(2)))) * 100
  );
  return Math.max(1, Math.min(99, percentile));
}

// Error function approximation for percentile calc
function erf(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x >= 0 ? 1 : -1;
  x = Math.abs(x);
  const t = 1.0 / (1.0 + p * x);
  const y =
    1.0 -
    ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return sign * y;
}
