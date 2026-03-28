import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius, Shadows } from '../constants/theme';
import {
  formatDuration,
  getReadingLevel,
  getWpmPercentile,
  formatTimeRemaining,
} from '../lib/rsvp';

interface CompletionStatsProps {
  wpm: number;
  wordsRead: number;
  durationSeconds: number;
  onShare?: () => void;
  onClose: () => void;
}

export function CompletionStats({
  wpm,
  wordsRead,
  durationSeconds,
  onShare,
  onClose,
}: CompletionStatsProps) {
  const level = getReadingLevel(wpm);
  const percentile = getWpmPercentile(wpm);

  return (
    <View style={styles.overlay}>
      <View style={styles.card}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.emoji}>{level.emoji}</Text>
          <Text style={styles.title}>Reading Complete!</Text>
          <Text style={styles.levelLabel}>{level.label}</Text>
        </View>

        {/* Stats grid */}
        <View style={styles.statsGrid}>
          <StatBox label="WPM" value={String(wpm)} highlight />
          <StatBox label="Words" value={formatNumber(wordsRead)} />
          <StatBox label="Time" value={formatDuration(durationSeconds)} />
          <StatBox label="Percentile" value={`Top ${100 - percentile}%`} />
        </View>

        {/* Percentile bar */}
        <View style={styles.percentileBar}>
          <View style={[styles.percentileFill, { width: `${percentile}%` }]} />
          <Text style={styles.percentileLabel}>
            Faster than {percentile}% of readers
          </Text>
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          {onShare && (
            <TouchableOpacity style={styles.shareBtn} onPress={onShare}>
              <Ionicons name="share-outline" size={18} color={Colors.textPrimary} />
              <Text style={styles.shareBtnText}>Share</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.doneBtn} onPress={onClose}>
            <Text style={styles.doneBtnText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

interface StatBoxProps {
  label: string;
  value: string;
  highlight?: boolean;
}

function StatBox({ label, value, highlight = false }: StatBoxProps) {
  return (
    <View style={styles.statBox}>
      <Text style={[styles.statValue, highlight && styles.statValueHighlight]}>
        {value}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

interface PauseStatsProps {
  wpm: number;
  wordsRead: number;
  wordsLeft: number;
  elapsedSeconds: number;
}

export function PauseStats({
  wpm,
  wordsRead,
  wordsLeft,
  elapsedSeconds,
}: PauseStatsProps) {
  const timeLeft = formatTimeRemaining(wordsLeft, wpm);

  return (
    <View style={styles.pauseStats}>
      <PauseStat label="WPM" value={String(wpm)} />
      <PauseStat label="Read" value={formatNumber(wordsRead)} />
      <PauseStat label="Elapsed" value={formatDuration(elapsedSeconds)} />
      <PauseStat label="Left" value={timeLeft} />
    </View>
  );
}

interface PauseStatProps {
  label: string;
  value: string;
}

function PauseStat({ label, value }: PauseStatProps) {
  return (
    <View style={styles.pauseStat}>
      <Text style={styles.pauseStatValue}>{value}</Text>
      <Text style={styles.pauseStatLabel}>{label}</Text>
    </View>
  );
}

function formatNumber(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.xl,
    width: '100%',
    gap: Spacing.lg,
    ...Shadows.md,
  },
  header: {
    alignItems: 'center',
    gap: Spacing.xs,
  },
  emoji: {
    fontSize: 48,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: Typography.xl,
    fontWeight: Typography.bold,
  },
  levelLabel: {
    color: Colors.gold,
    fontSize: Typography.md,
    fontWeight: Typography.semibold,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  statBox: {
    flex: 1,
    backgroundColor: Colors.elevated,
    borderRadius: Radius.md,
    padding: Spacing.md,
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    color: Colors.textPrimary,
    fontSize: Typography.lg,
    fontWeight: Typography.bold,
  },
  statValueHighlight: {
    color: Colors.gold,
    fontSize: Typography.xl,
  },
  statLabel: {
    color: Colors.textMuted,
    fontSize: Typography.xs,
  },
  percentileBar: {
    gap: Spacing.xs,
  },
  percentileFill: {
    height: 4,
    backgroundColor: Colors.gold,
    borderRadius: 2,
    maxWidth: '100%',
  },
  percentileLabel: {
    color: Colors.textMuted,
    fontSize: Typography.sm,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  shareBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.elevated,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  shareBtnText: {
    color: Colors.textPrimary,
    fontSize: Typography.md,
    fontWeight: Typography.medium,
  },
  doneBtn: {
    flex: 2,
    backgroundColor: Colors.gold,
    borderRadius: Radius.md,
    padding: Spacing.md,
    alignItems: 'center',
  },
  doneBtnText: {
    color: Colors.bg,
    fontSize: Typography.md,
    fontWeight: Typography.bold,
  },
  // Pause stats
  pauseStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: Radius.lg,
    padding: Spacing.md,
  },
  pauseStat: {
    alignItems: 'center',
    gap: 2,
  },
  pauseStatValue: {
    color: Colors.textPrimary,
    fontSize: Typography.md,
    fontWeight: Typography.bold,
  },
  pauseStatLabel: {
    color: Colors.textMuted,
    fontSize: Typography.xs,
  },
});
