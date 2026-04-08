// ═══════════════════════════════════════════════════════════════
// Warpreader — Library Module (library.js)
// IndexedDB-first document library with Supabase cloud sync for Pro
// ═══════════════════════════════════════════════════════════════

(function () {
  'use strict';

  // ── IndexedDB Setup ──
  const DB_NAME = 'warpreader';
  const DB_VERSION = 2; // bump from v1 (which only had 'documents' store)
  let _db = null;

  function openLibraryDB() {
    return new Promise((resolve, reject) => {
      if (_db) return resolve(_db);
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('documents')) {
          db.createObjectStore('documents', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('reading_sessions')) {
          db.createObjectStore('reading_sessions', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('streak')) {
          db.createObjectStore('streak', { keyPath: 'key' });
        }
      };
      req.onsuccess = (e) => { _db = e.target.result; resolve(_db); };
      req.onerror = () => reject(req.error);
    });
  }

  // ── Generic IDB helpers ──
  async function idbPut(storeName, data) {
    const db = await openLibraryDB();
    return new Promise((resolve) => {
      const tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).put(data);
      tx.oncomplete = () => resolve();
    });
  }

  async function idbGet(storeName, key) {
    const db = await openLibraryDB();
    return new Promise((resolve) => {
      const req = db.transaction(storeName).objectStore(storeName).get(key);
      req.onsuccess = () => resolve(req.result || null);
    });
  }

  async function idbGetAll(storeName) {
    const db = await openLibraryDB();
    return new Promise((resolve) => {
      const req = db.transaction(storeName).objectStore(storeName).getAll();
      req.onsuccess = () => resolve(req.result || []);
    });
  }

  async function idbDelete(storeName, key) {
    const db = await openLibraryDB();
    return new Promise((resolve) => {
      const tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).delete(key);
      tx.oncomplete = () => resolve();
    });
  }

  // ── Document Library ──
  const FREE_DOC_LIMIT = 3;

  // Get all library documents (metadata from localStorage, content from IDB)
  function getLibraryMeta() {
    try { return JSON.parse(localStorage.getItem('wr_library') || '[]'); } catch { return []; }
  }

  function saveLibraryMeta(lib) {
    localStorage.setItem('wr_library', JSON.stringify(lib));
  }

  /**
   * Save a document to the library
   * @returns {string|null} document id or null if limit hit
   */
  async function saveToLibrary(title, format, content, totalWords, opts = {}) {
    const lib = getLibraryMeta();
    const isProUser = typeof isPro === 'function' && isPro();

    // Check free limit
    if (!isProUser && lib.length >= FREE_DOC_LIMIT) {
      return null; // caller should show upgrade prompt
    }

    // Check if already exists
    const existing = lib.find(d => d.title === title);
    if (existing) {
      // Update content in IDB
      await idbPut('documents', { id: existing.id, content });
      existing.totalWords = totalWords;
      existing.lastReadAt = Date.now();
      saveLibraryMeta(lib);
      return existing.id;
    }

    const id = 'doc_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    const meta = {
      id,
      title,
      format: format || detectFormat(title),
      totalWords: totalWords || 0,
      position: 0,
      progress: 0,
      addedAt: Date.now(),
      lastReadAt: Date.now(),
    };

    // Store content in IndexedDB (large data)
    await idbPut('documents', { id, content });

    // Store metadata in localStorage (fast access)
    lib.push(meta);
    saveLibraryMeta(lib);

    // Sync to Supabase for Pro users
    if (isProUser) {
      _syncDocToCloud(meta, content);
    }

    return id;
  }

  function detectFormat(filename) {
    if (!filename) return 'TXT';
    const ext = filename.split('.').pop().toLowerCase();
    if (ext === 'pdf') return 'PDF';
    if (ext === 'epub') return 'EPUB';
    if (ext === 'md') return 'MD';
    return 'TXT';
  }

  /**
   * Update reading position for a document
   */
  function updateDocPosition(docId, position, totalWords) {
    const lib = getLibraryMeta();
    const doc = lib.find(d => d.id === docId);
    if (!doc) return;
    doc.position = position;
    doc.progress = totalWords > 0 ? Math.round((position / totalWords) * 100) : 0;
    doc.lastReadAt = Date.now();
    saveLibraryMeta(lib);
  }

  /**
   * Get document content from IDB
   */
  async function getDocContent(docId) {
    const result = await idbGet('documents', docId);
    return result ? result.content : null;
  }

  /**
   * Delete a document
   */
  async function deleteFromLibrary(docId) {
    await idbDelete('documents', docId);
    const lib = getLibraryMeta().filter(d => d.id !== docId);
    saveLibraryMeta(lib);
  }

  // ── Reading Sessions ──

  async function logReadingSession(docId, wordsRead, avgWpm, durationSec) {
    const session = {
      id: 'sess_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      docId,
      startedAt: Date.now() - (durationSec * 1000),
      endedAt: Date.now(),
      wordsRead: wordsRead || 0,
      avgWpm: avgWpm || 0,
    };
    await idbPut('reading_sessions', session);

    // Update cumulative stats
    const stats = getCumulativeStats();
    stats.totalWordsRead = (stats.totalWordsRead || 0) + (wordsRead || 0);
    stats.totalSessions = (stats.totalSessions || 0) + 1;
    stats.totalReadingTimeSec = (stats.totalReadingTimeSec || 0) + (durationSec || 0);
    // Rolling average WPM
    if (avgWpm > 0) {
      const prev = stats.avgWpm || 0;
      const n = stats.totalSessions;
      stats.avgWpm = Math.round(prev + (avgWpm - prev) / n);
    }
    saveCumulativeStats(stats);

    return session;
  }

  async function getRecentSessions(limit = 20) {
    const all = await idbGetAll('reading_sessions');
    all.sort((a, b) => (b.endedAt || 0) - (a.endedAt || 0));
    return all.slice(0, limit);
  }

  // Weekly reading time
  async function getWeeklyReadingTime() {
    const sessions = await idbGetAll('reading_sessions');
    const weekAgo = Date.now() - 7 * 86400000;
    let totalSec = 0;
    const dailyMinutes = {};
    for (const s of sessions) {
      if ((s.endedAt || s.startedAt) >= weekAgo) {
        const dur = ((s.endedAt || s.startedAt) - s.startedAt) / 1000;
        totalSec += dur;
        const day = new Date(s.startedAt).toLocaleDateString('en-US', { weekday: 'short' });
        dailyMinutes[day] = (dailyMinutes[day] || 0) + Math.round(dur / 60);
      }
    }
    return { totalMinutes: Math.round(totalSec / 60), daily: dailyMinutes };
  }

  // ── Cumulative Stats (localStorage) ──
  function getCumulativeStats() {
    try { return JSON.parse(localStorage.getItem('wr_library_stats') || '{}'); } catch { return {}; }
  }

  function saveCumulativeStats(stats) {
    localStorage.setItem('wr_library_stats', JSON.stringify(stats));
  }

  // ── Reading Streak ──

  function getStreak() {
    try {
      return JSON.parse(localStorage.getItem('wr_streak') || '{"current":0,"best":0,"lastDate":""}');
    } catch {
      return { current: 0, best: 0, lastDate: '' };
    }
  }

  function recordStreakToday() {
    const today = new Date().toISOString().split('T')[0];
    const streak = getStreak();
    if (streak.lastDate === today) return streak; // already recorded today

    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    if (streak.lastDate === yesterday) {
      streak.current += 1;
    } else {
      streak.current = 1;
    }
    if (streak.current > streak.best) streak.best = streak.current;
    streak.lastDate = today;
    localStorage.setItem('wr_streak', JSON.stringify(streak));

    // Sync to Supabase for Pro users
    if (typeof isPro === 'function' && isPro() && typeof supabaseClient !== 'undefined' && supabaseClient && typeof currentUser !== 'undefined' && currentUser) {
      supabaseClient.from('reading_streaks').upsert({
        user_id: currentUser.id,
        current_streak: streak.current,
        longest_streak: streak.best,
        last_read_date: today,
      }, { onConflict: 'user_id' }).catch(() => {});
    }

    return streak;
  }

  // ── Cloud Sync (Pro) ──

  async function _syncDocToCloud(meta, content) {
    if (typeof supabaseClient === 'undefined' || !supabaseClient) return;
    if (typeof currentUser === 'undefined' || !currentUser) return;
    try {
      await supabaseClient.from('documents').upsert({
        user_id: currentUser.id,
        title: meta.title,
        format: meta.format,
        content: content && content.length < 4 * 1024 * 1024 ? content : null,
        position: meta.position || 0,
        total_words: meta.totalWords || 0,
        progress: meta.progress || 0,
        added_at: new Date(meta.addedAt).toISOString(),
        last_read_at: new Date(meta.lastReadAt).toISOString(),
      }, { onConflict: 'user_id, title' });
    } catch (e) {
      console.warn('[Library] Cloud sync failed:', e);
    }
  }

  async function syncFromCloud() {
    if (typeof supabaseClient === 'undefined' || !supabaseClient) return;
    if (typeof currentUser === 'undefined' || !currentUser) return;
    if (typeof isPro !== 'function' || !isPro()) return;

    try {
      const { data, error } = await supabaseClient
        .from('documents')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('last_read_at', { ascending: false });

      if (error || !data) return;

      const localLib = getLibraryMeta();
      for (const cloudDoc of data) {
        const existing = localLib.find(d => d.title === cloudDoc.title);
        if (!existing) {
          // New doc from cloud
          const id = 'doc_cloud_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
          if (cloudDoc.content) {
            await idbPut('documents', { id, content: cloudDoc.content });
          }
          localLib.push({
            id,
            title: cloudDoc.title,
            format: cloudDoc.format || 'TXT',
            totalWords: cloudDoc.total_words || 0,
            position: cloudDoc.position || 0,
            progress: cloudDoc.progress || 0,
            addedAt: new Date(cloudDoc.added_at).getTime(),
            lastReadAt: cloudDoc.last_read_at ? new Date(cloudDoc.last_read_at).getTime() : Date.now(),
          });
        } else {
          // Update position if cloud is newer
          const cloudTime = cloudDoc.last_read_at ? new Date(cloudDoc.last_read_at).getTime() : 0;
          if (cloudTime > (existing.lastReadAt || 0)) {
            existing.position = cloudDoc.position || existing.position;
            existing.progress = cloudDoc.progress || existing.progress;
            existing.lastReadAt = cloudTime;
          }
        }
      }
      saveLibraryMeta(localLib);

      // Sync streak from cloud
      const { data: streakData } = await supabaseClient
        .from('reading_streaks')
        .select('*')
        .eq('user_id', currentUser.id)
        .single();
      if (streakData) {
        const local = getStreak();
        if ((streakData.current_streak || 0) > (local.current || 0)) {
          local.current = streakData.current_streak;
          local.best = Math.max(local.best, streakData.longest_streak || 0);
          local.lastDate = streakData.last_read_date || local.lastDate;
          localStorage.setItem('wr_streak', JSON.stringify(local));
        }
      }
    } catch (e) {
      console.warn('[Library] Cloud sync from failed:', e);
    }
  }

  // ── Documents Completed Count ──
  function getCompletedCount() {
    const lib = getLibraryMeta();
    return lib.filter(d => d.progress >= 90).length;
  }

  // ── Expose API ──
  window.WarpLibrary = {
    // DB
    openLibraryDB,
    // Documents
    getLibraryMeta,
    saveToLibrary,
    updateDocPosition,
    getDocContent,
    deleteFromLibrary,
    getCompletedCount,
    detectFormat,
    FREE_DOC_LIMIT,
    // Sessions
    logReadingSession,
    getRecentSessions,
    getWeeklyReadingTime,
    // Stats
    getCumulativeStats,
    saveCumulativeStats,
    // Streak
    getStreak,
    recordStreakToday,
    // Cloud
    syncFromCloud,
  };

})();
