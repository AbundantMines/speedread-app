const BASE_URL = 'https://warpreader.com/api';
const GUTENDEX_URL = 'https://gutendex.com/books';

// --- WPM API ---
export interface WpmRecord {
  userId: string;
  wpm: number;
  date: string;
  documentTitle?: string;
}

export async function postWpm(record: WpmRecord): Promise<void> {
  const res = await fetch(`${BASE_URL}/wpm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(record),
  });
  if (!res.ok) {
    throw new Error(`WPM post failed: ${res.status}`);
  }
}

export async function getWpmHistory(userId: string): Promise<WpmRecord[]> {
  const res = await fetch(`${BASE_URL}/wpm?userId=${encodeURIComponent(userId)}`);
  if (!res.ok) {
    throw new Error(`WPM fetch failed: ${res.status}`);
  }
  return res.json();
}

// --- Gutenberg / Gutendex ---
export interface GutenbergBook {
  id: number;
  title: string;
  authors: { name: string; birth_year?: number; death_year?: number }[];
  subjects: string[];
  bookshelves: string[];
  languages: string[];
  download_count: number;
  formats: Record<string, string>;
}

export interface GutenbergSearchResult {
  count: number;
  next: string | null;
  previous: string | null;
  results: GutenbergBook[];
}

export async function searchGutenberg(
  query: string,
  page = 1
): Promise<GutenbergSearchResult> {
  const url = new URL(GUTENDEX_URL);
  url.searchParams.set('search', query);
  url.searchParams.set('languages', 'en');
  url.searchParams.set('mime_type', 'text/plain');
  if (page > 1) url.searchParams.set('page', String(page));

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Gutenberg search failed: ${res.status}`);
  }
  return res.json();
}

export async function getGutenbergByCategory(
  category: string
): Promise<GutenbergSearchResult> {
  const url = new URL(GUTENDEX_URL);
  url.searchParams.set('topic', category);
  url.searchParams.set('languages', 'en');
  url.searchParams.set('mime_type', 'text/plain');

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Gutenberg category fetch failed: ${res.status}`);
  }
  return res.json();
}

export async function downloadGutenbergBook(book: GutenbergBook): Promise<string> {
  // Prefer plain text UTF-8, fallback to plain text
  const textUrl =
    book.formats['text/plain; charset=utf-8'] ||
    book.formats['text/plain; charset=us-ascii'] ||
    book.formats['text/plain'] ||
    Object.entries(book.formats).find(([k]) => k.startsWith('text/plain'))?.[1];

  if (!textUrl) {
    throw new Error('No plain text format available for this book');
  }

  const res = await fetch(textUrl);
  if (!res.ok) {
    throw new Error(`Book download failed: ${res.status}`);
  }

  const text = await res.text();
  // Strip Project Gutenberg header/footer
  return cleanGutenbergText(text);
}

function cleanGutenbergText(text: string): string {
  // Remove PG header (everything before "*** START OF THE PROJECT GUTENBERG")
  const startMarker = /\*{3}\s*START OF (THE |THIS )?PROJECT GUTENBERG/i;
  const endMarker = /\*{3}\s*END OF (THE |THIS )?PROJECT GUTENBERG/i;

  let cleaned = text;
  const startMatch = text.search(startMarker);
  if (startMatch !== -1) {
    const afterStart = text.indexOf('\n', startMatch);
    cleaned = text.slice(afterStart + 1);
  }

  const endMatch = cleaned.search(endMarker);
  if (endMatch !== -1) {
    cleaned = cleaned.slice(0, endMatch);
  }

  return cleaned.trim();
}

// --- Article extraction ---
export async function extractArticleText(url: string): Promise<string> {
  // Use a simple fetch + basic extraction
  // In production, you'd use a dedicated readability API
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Warpreader/1.0 (iOS)',
    },
  });
  if (!res.ok) {
    throw new Error(`Article fetch failed: ${res.status}`);
  }
  const html = await res.text();
  return extractTextFromHtml(html);
}

function extractTextFromHtml(html: string): string {
  // Basic extraction: strip tags, decode entities
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// --- Pro upgrade ---
export function getCheckoutUrl(userId?: string): string {
  const base = 'https://warpreader.com/checkout';
  if (userId) return `${base}?userId=${encodeURIComponent(userId)}&source=ios`;
  return base;
}

export function getCustomerPortalUrl(userId?: string): string {
  const base = 'https://warpreader.com/portal';
  if (userId) return `${base}?userId=${encodeURIComponent(userId)}&source=ios`;
  return base;
}
