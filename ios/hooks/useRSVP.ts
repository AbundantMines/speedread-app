import { useState, useEffect, useRef, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { tokenizeText, getDelay, splitWordAtORP, WordParts } from '../lib/rsvp';

export type RSVPState = 'idle' | 'playing' | 'paused' | 'complete';

export interface RSVPSession {
  words: string[];
  currentIndex: number;
  wpm: number;
  state: RSVPState;
  currentWordParts: WordParts;
  startTime: number | null;
  wordsReadSinceStart: number;
  elapsedSeconds: number;
}

export interface UseRSVPOptions {
  text: string;
  initialWpm?: number;
  initialIndex?: number;
  onComplete?: (session: { wpm: number; wordsRead: number; durationSeconds: number }) => void;
  onProgress?: (index: number, total: number) => void;
}

export function useRSVP({
  text,
  initialWpm = 250,
  initialIndex = 0,
  onComplete,
  onProgress,
}: UseRSVPOptions) {
  const words = useRef<string[]>(tokenizeText(text));
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const sessionStartIndexRef = useRef(initialIndex);
  const elapsedIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [state, setState] = useState<RSVPState>('idle');
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [wpm, setWpm] = useState(initialWpm);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Restore user's preferred WPM from last session
  useEffect(() => {
    AsyncStorage.getItem('warpreader_preferred_wpm').then((saved) => {
      if (saved) {
        const v = parseInt(saved, 10);
        if (v >= 50 && v <= 1500) setWpm(v);
      }
    }).catch(() => {});
  }, []);

  const currentWord = words.current[currentIndex] || '';
  const currentWordParts = splitWordAtORP(currentWord);
  const totalWords = words.current.length;

  // Clear timers
  const clearTimers = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (elapsedIntervalRef.current) clearInterval(elapsedIntervalRef.current);
  }, []);

  // Advance to next word
  const advance = useCallback(
    (index: number, currentWpm: number) => {
      const word = words.current[index];
      if (!word) return;

      const delay = getDelay(word, currentWpm);
      timerRef.current = setTimeout(() => {
        const nextIndex = index + 1;

        if (nextIndex >= words.current.length) {
          // Completed
          setState('complete');
          clearTimers();
          if (onComplete && startTimeRef.current) {
            const durationSeconds = Math.round(
              (Date.now() - startTimeRef.current) / 1000
            );
            const wordsRead = nextIndex - sessionStartIndexRef.current;
            onComplete({ wpm: currentWpm, wordsRead, durationSeconds });
          }
        } else {
          setCurrentIndex(nextIndex);
          onProgress?.(nextIndex, words.current.length);
          advance(nextIndex, currentWpm);
        }
      }, delay);
    },
    [clearTimers, onComplete, onProgress]
  );

  // Play
  const play = useCallback(() => {
    if (state === 'complete') return;
    startTimeRef.current = Date.now();
    sessionStartIndexRef.current = currentIndex;
    setState('playing');

    elapsedIntervalRef.current = setInterval(() => {
      if (startTimeRef.current) {
        setElapsedSeconds(Math.round((Date.now() - startTimeRef.current) / 1000));
      }
    }, 1000);

    advance(currentIndex, wpm);
  }, [state, currentIndex, wpm, advance]);

  // Pause
  const pause = useCallback(() => {
    clearTimers();
    setState('paused');
  }, [clearTimers]);

  // Toggle play/pause
  const toggle = useCallback(() => {
    if (state === 'playing') {
      pause();
    } else {
      play();
    }
  }, [state, play, pause]);

  // Skip words
  const skip = useCallback(
    (delta: number) => {
      const wasPlaying = state === 'playing';
      if (wasPlaying) {
        clearTimers();
      }
      setCurrentIndex((prev) => {
        const next = Math.max(0, Math.min(prev + delta, totalWords - 1));
        if (wasPlaying) {
          // Resume from new position
          setTimeout(() => {
            advance(next, wpm);
          }, 0);
        }
        return next;
      });
    },
    [state, totalWords, wpm, clearTimers, advance]
  );

  // Change WPM — also persists as user's preferred speed
  const changeWpm = useCallback(
    (newWpm: number) => {
      const clamped = Math.max(50, Math.min(1500, newWpm));
      setWpm(clamped);
      // Persist preferred WPM for next session
      try { AsyncStorage.setItem('warpreader_preferred_wpm', String(clamped)); } catch {}
      if (state === 'playing') {
        clearTimers();
        // Resume with new WPM
        setState('playing');
        advance(currentIndex, clamped);
      }
    },
    [state, currentIndex, advance, clearTimers]
  );

  // Reset
  const reset = useCallback(() => {
    clearTimers();
    setState('idle');
    setCurrentIndex(0);
    setElapsedSeconds(0);
    startTimeRef.current = null;
  }, [clearTimers]);

  // Cleanup on unmount
  useEffect(() => {
    return () => clearTimers();
  }, [clearTimers]);

  // Re-tokenize if text changes
  useEffect(() => {
    words.current = tokenizeText(text);
    reset();
  }, [text, reset]);

  const wordsRead = currentIndex - sessionStartIndexRef.current;
  const wordsLeft = totalWords - currentIndex;
  const progress = totalWords > 0 ? currentIndex / totalWords : 0;

  return {
    state,
    currentIndex,
    currentWord,
    currentWordParts,
    wpm,
    totalWords,
    wordsRead: Math.max(0, wordsRead),
    wordsLeft,
    progress,
    elapsedSeconds,
    play,
    pause,
    toggle,
    skip,
    changeWpm,
    reset,
  };
}
