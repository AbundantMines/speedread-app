import { useCallback } from 'react';
import { supabase, SavedDocument, ReadingSession } from '../lib/supabase';
import {
  getSavedDocuments,
  getReadingSessions,
  saveDocument,
  saveReadingSession,
  getPendingSync,
  removePendingSync,
  LocalDocument,
  LocalReadingSession,
} from '../lib/storage';
import { postWpm } from '../lib/api';

export function useSync(userId?: string) {
  const syncDocuments = useCallback(async () => {
    if (!userId) return;

    try {
      // Pull from Supabase
      const { data, error } = await supabase
        .from('saved_documents')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Merge into local storage
      for (const doc of data || []) {
        const localDoc: LocalDocument = {
          id: doc.id,
          title: doc.title,
          content: doc.content,
          wordCount: doc.word_count,
          sourceUrl: doc.source_url,
          createdAt: doc.created_at,
          lastReadAt: doc.last_read_at,
          readingProgress: doc.reading_progress || 0,
          synced: true,
        };
        await saveDocument(localDoc);
      }

      // Push local unsynced docs to Supabase
      const localDocs = await getSavedDocuments();
      const unsynced = localDocs.filter((d) => !d.synced);

      for (const doc of unsynced) {
        const { error: pushError } = await supabase
          .from('saved_documents')
          .upsert({
            id: doc.id,
            user_id: userId,
            title: doc.title,
            content: doc.content,
            word_count: doc.wordCount,
            source_url: doc.sourceUrl,
            created_at: doc.createdAt,
            last_read_at: doc.lastReadAt,
            reading_progress: doc.readingProgress,
          });

        if (!pushError) {
          await saveDocument({ ...doc, synced: true });
        }
      }
    } catch (err) {
      console.warn('Sync documents failed:', err);
    }
  }, [userId]);

  const syncReadingSessions = useCallback(async () => {
    if (!userId) return;

    try {
      const sessions = await getReadingSessions();
      const unsynced = sessions.filter((s) => !s.synced);

      for (const session of unsynced) {
        // Push to Supabase
        const { error } = await supabase.from('reading_sessions').upsert({
          id: session.id,
          user_id: userId,
          document_id: session.documentId,
          document_title: session.documentTitle,
          wpm: session.wpm,
          words_read: session.wordsRead,
          duration_seconds: session.durationSeconds,
          completed: session.completed,
          created_at: session.createdAt,
        });

        if (!error) {
          // Also post to WPM API
          try {
            await postWpm({
              userId,
              wpm: session.wpm,
              date: session.createdAt,
              documentTitle: session.documentTitle,
            });
          } catch {
            // Non-fatal
          }

          // Mark as synced
          await saveReadingSession({ ...session, synced: true });
        }
      }
    } catch (err) {
      console.warn('Sync reading sessions failed:', err);
    }
  }, [userId]);

  const syncAll = useCallback(async () => {
    await Promise.all([syncDocuments(), syncReadingSessions()]);
  }, [syncDocuments, syncReadingSessions]);

  return { syncAll, syncDocuments, syncReadingSessions };
}
