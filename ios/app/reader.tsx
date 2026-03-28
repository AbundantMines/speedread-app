import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Dimensions,
  PanResponder,
  Share,
  Alert,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Typography, Spacing, Radius } from '../constants/theme';
import { useRSVP } from '../hooks/useRSVP';
import { useAuth } from '../hooks/useAuth';
import { RSVPWord } from '../components/RSVPWord';
import { PauseStats, CompletionStats } from '../components/StatsCard';
import {
  saveReadingSession,
  addWpmEntry,
  updateDocumentProgress,
  getUserSettings,
} from '../lib/storage';
import { formatTimeRemaining, getReadingLevel } from '../lib/rsvp';

const { width, height } = Dimensions.get('window');

export default function ReaderScreen() {
  const params = useLocalSearchParams<{
    documentId?: string;
    title?: string;
    content?: string;
    startIndex?: string;
  }>();

  const { user } = useAuth();
  const [settings, setSettings] = React.useState({ fontSize: 42, darkMode: true });
  const [showControls, setShowControls] = useState(true);
  const [showStats, setShowStats] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [finalStats, setFinalStats] = useState<{
    wpm: number;
    wordsRead: number;
    durationSeconds: number;
  } | null>(null);

  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  React.useEffect(() => {
    getUserSettings().then((s) =>
      setSettings({ fontSize: s.fontSize, darkMode: s.darkMode })
    );
  }, []);

  const content = params.content || '';
  const title = params.title || 'Reading';
  const initialIndex = parseInt(params.startIndex || '0', 10);

  const handleComplete = useCallback(
    async (stats: { wpm: number; wordsRead: number; durationSeconds: number }) => {
      setFinalStats(stats);
      setCompleted(true);

      // Save session
      const session = {
        id: `session_${Date.now()}`,
        documentId: params.documentId,
        documentTitle: title,
        wpm: stats.wpm,
        wordsRead: stats.wordsRead,
        durationSeconds: stats.durationSeconds,
        completed: true,
        createdAt: new Date().toISOString(),
        synced: false,
      };
      await saveReadingSession(session);
      await addWpmEntry({ wpm: stats.wpm, date: new Date().toISOString(), documentTitle: title });

      if (params.documentId) {
        await updateDocumentProgress(params.documentId, 1);
      }
    },
    [params.documentId, title]
  );

  const {
    state,
    currentWordParts,
    wpm,
    totalWords,
    wordsRead,
    wordsLeft,
    progress,
    elapsedSeconds,
    toggle,
    skip,
    changeWpm,
  } = useRSVP({
    text: content,
    initialWpm: 250,
    initialIndex,
    onComplete: handleComplete,
    onProgress: useCallback(
      async (index: number, total: number) => {
        if (params.documentId && index % 50 === 0) {
          await updateDocumentProgress(params.documentId, index / total);
        }
      },
      [params.documentId]
    ),
  });

  // Swipe gestures
  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, g) =>
      Math.abs(g.dx) > 10 || Math.abs(g.dy) > 10,
    onPanResponderRelease: (_, g) => {
      const absX = Math.abs(g.dx);
      const absY = Math.abs(g.dy);

      if (absX > absY && absX > 30) {
        // Horizontal swipe → skip words
        if (g.dx < 0) {
          skip(10); // forward 10 words
        } else {
          skip(-10); // back 10 words
        }
      } else if (absY > absX && absY > 30) {
        // Vertical swipe → change WPM
        if (g.dy < 0) {
          changeWpm(wpm + 25); // faster
        } else {
          changeWpm(wpm - 25); // slower
        }
      } else {
        // Tap → toggle controls
        toggleControls();
      }
    },
  });

  const toggleControls = () => {
    setShowControls((v) => !v);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    if (!showControls) {
      controlsTimeoutRef.current = setTimeout(() => setShowControls(false), 3000);
    }
  };

  const handleShare = async () => {
    if (!finalStats) return;
    const level = getReadingLevel(finalStats.wpm);
    try {
      await Share.share({
        message: `Just read "${title}" at ${finalStats.wpm} WPM on Warpreader! ${level.emoji} ${level.label} level. Get the app at warpreader.com`,
      });
    } catch (err) {
      // ignore
    }
  };

  const handleClose = () => {
    router.back();
  };

  const bgColor = settings.darkMode ? Colors.bg : Colors.lightBg;
  const isPaused = state === 'idle' || state === 'paused';

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      <StatusBar hidden />

      {/* Progress bar */}
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>

      {/* Top bar */}
      {showControls && (
        <SafeAreaView style={styles.topBar}>
          <TouchableOpacity style={styles.closeBtn} onPress={handleClose}>
            <Ionicons name="chevron-down" size={24} color={Colors.textMuted} />
          </TouchableOpacity>
          <Text style={styles.titleText} numberOfLines={1}>
            {title}
          </Text>
          <View style={styles.wpmBadge}>
            <Text style={styles.wpmBadgeText}>{wpm}</Text>
          </View>
        </SafeAreaView>
      )}

      {/* Main word display */}
      <View style={styles.wordArea} {...panResponder.panHandlers}>
        {/* Focus lines */}
        <View style={[styles.focusLine, styles.focusLineTop, { backgroundColor: Colors.border }]} />
        <View style={[styles.focusLine, styles.focusLineBottom, { backgroundColor: Colors.border }]} />

        <RSVPWord
          parts={currentWordParts}
          fontSize={settings.fontSize}
          isDark={settings.darkMode}
        />

        {/* Pause overlay stats */}
        {isPaused && state !== 'idle' && wordsRead > 0 && (
          <View style={styles.pauseStatsContainer}>
            <PauseStats
              wpm={wpm}
              wordsRead={wordsRead}
              wordsLeft={wordsLeft}
              elapsedSeconds={elapsedSeconds}
            />
          </View>
        )}
      </View>

      {/* Bottom controls */}
      {showControls && (
        <View style={styles.bottomControls}>
          {/* WPM Slider */}
          <View style={styles.sliderRow}>
            <Text style={styles.sliderLabel}>50</Text>
            <Slider
              style={styles.slider}
              minimumValue={50}
              maximumValue={1500}
              step={25}
              value={wpm}
              onValueChange={changeWpm}
              minimumTrackTintColor={Colors.gold}
              maximumTrackTintColor={Colors.border}
              thumbTintColor={Colors.gold}
            />
            <Text style={styles.sliderLabel}>1500</Text>
          </View>
          <Text style={styles.wpmLabel}>{wpm} WPM</Text>

          {/* Play/Pause + Skip controls */}
          <View style={styles.controlRow}>
            <TouchableOpacity style={styles.skipBtn} onPress={() => skip(-10)}>
              <Ionicons name="play-back" size={22} color={Colors.textMuted} />
              <Text style={styles.skipLabel}>10</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.playBtn} onPress={toggle}>
              <Ionicons
                name={state === 'playing' ? 'pause' : 'play'}
                size={32}
                color={Colors.bg}
              />
            </TouchableOpacity>

            <TouchableOpacity style={styles.skipBtn} onPress={() => skip(10)}>
              <Text style={styles.skipLabel}>10</Text>
              <Ionicons name="play-forward" size={22} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Word count */}
          <Text style={styles.wordProgress}>
            {wordsRead}/{totalWords} · {formatTimeRemaining(wordsLeft, wpm)} left
          </Text>
        </View>
      )}

      {/* Completion overlay */}
      {completed && finalStats && (
        <CompletionStats
          wpm={finalStats.wpm}
          wordsRead={finalStats.wordsRead}
          durationSeconds={finalStats.durationSeconds}
          onShare={handleShare}
          onClose={handleClose}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  progressBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: Colors.border,
    zIndex: 10,
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.gold,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingTop: 8,
    zIndex: 5,
  },
  closeBtn: {
    padding: Spacing.sm,
  },
  titleText: {
    flex: 1,
    color: Colors.textMuted,
    fontSize: Typography.sm,
    textAlign: 'center',
    paddingHorizontal: Spacing.sm,
  },
  wpmBadge: {
    backgroundColor: Colors.elevated,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  wpmBadgeText: {
    color: Colors.gold,
    fontSize: Typography.xs,
    fontWeight: Typography.bold,
  },
  wordArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
  },
  focusLine: {
    position: 'absolute',
    left: Spacing.lg,
    right: Spacing.lg,
    height: 1,
    opacity: 0.3,
  },
  focusLineTop: {
    top: '40%',
  },
  focusLineBottom: {
    top: '60%',
  },
  pauseStatsContainer: {
    position: 'absolute',
    bottom: 20,
    left: Spacing.lg,
    right: Spacing.lg,
  },
  bottomControls: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: 40,
    gap: Spacing.sm,
    alignItems: 'center',
  },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    gap: Spacing.sm,
  },
  slider: {
    flex: 1,
    height: 40,
  },
  sliderLabel: {
    color: Colors.textDisabled,
    fontSize: Typography.xs,
    width: 28,
    textAlign: 'center',
  },
  wpmLabel: {
    color: Colors.gold,
    fontSize: Typography.md,
    fontWeight: Typography.semibold,
  },
  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xl,
  },
  skipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: Spacing.sm,
  },
  skipLabel: {
    color: Colors.textMuted,
    fontSize: Typography.xs,
  },
  playBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.gold,
    justifyContent: 'center',
    alignItems: 'center',
  },
  wordProgress: {
    color: Colors.textDisabled,
    fontSize: Typography.sm,
  },
});
