import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Colors, Typography, Spacing, Radius } from '../../constants/theme';
import { WPMChart } from '../../components/WPMChart';
import { StreakCalendar } from '../../components/StreakCalendar';
import {
  getReadingSessions,
  getWpmHistory,
  calculateStreak,
  LocalReadingSession,
  WpmEntry,
} from '../../lib/storage';
import { getReadingLevel, READING_LEVELS } from '../../lib/rsvp';
import { useAuth } from '../../hooks/useAuth';
import { useSync } from '../../hooks/useSync';

interface Stats {
  totalWords: number;
  totalSessions: number;
  avgWpm: number;
  bestWpm: number;
  streak: number;
}

export default function ProgressScreen() {
  const { user } = useAuth();
  const { syncAll } = useSync(user?.id);

  const [sessions, setSessions] = useState<LocalReadingSession[]>([]);
  const [wpmHistory, setWpmHistory] = useState<WpmEntry[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalWords: 0,
    totalSessions: 0,
    avgWpm: 0,
    bestWpm: 0,
    streak: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    const [sessions, history] = await Promise.all([
      getReadingSessions(),
      getWpmHistory(),
    ]);

    setSessions(sessions);
    setWpmHistory(history.slice(0, 30).reverse());

    const completedSessions = sessions.filter((s) => s.completed);
    const totalWords = completedSessions.reduce((sum, s) => sum + s.wordsRead, 0);
    const wpms = history.map((h) => h.wpm);
    const avgWpm = wpms.length > 0 ? Math.round(wpms.reduce((a, b) => a + b, 0) / wpms.length) : 0;
    const bestWpm = wpms.length > 0 ? Math.max(...wpms) : 0;
    const streak = calculateStreak(sessions);

    setStats({
      totalWords,
      totalSessions: completedSessions.length,
      avgWpm,
      bestWpm,
      streak,
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData().finally(() => setLoading(false));
      if (user?.id) syncAll();
    }, [loadData, user?.id, syncAll])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const level = getReadingLevel(stats.avgWpm || 0);
  const nextLevel = READING_LEVELS.find((l) => l.minWpm > (stats.avgWpm || 0));
  const levelProgress = nextLevel
    ? (stats.avgWpm - level.minWpm) / (nextLevel.minWpm - level.minWpm)
    : 1;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={Colors.gold} size="large" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={Colors.gold}
        />
      }
    >
      {/* Header */}
      <Text style={styles.headerTitle}>Progress</Text>

      {/* Level card */}
      <View style={styles.levelCard}>
        <View style={styles.levelHeader}>
          <Text style={styles.levelEmoji}>{level.emoji}</Text>
          <View>
            <Text style={styles.levelTitle}>{level.label}</Text>
            <Text style={styles.levelSubtitle}>
              {stats.avgWpm > 0 ? `${stats.avgWpm} WPM average` : 'Start reading to level up'}
            </Text>
          </View>
          {nextLevel && (
            <Text style={styles.nextLevel}>→ {nextLevel.label}</Text>
          )}
        </View>

        {/* Level progress bar */}
        <View style={styles.levelBar}>
          <View style={[styles.levelBarFill, { width: `${Math.round(levelProgress * 100)}%` }]} />
        </View>
        {nextLevel && (
          <Text style={styles.levelBarLabel}>
            {stats.avgWpm} / {nextLevel.minWpm} WPM to reach {nextLevel.label}
          </Text>
        )}
      </View>

      {/* Stats grid */}
      <View style={styles.statsGrid}>
        <StatBox value={formatNumber(stats.totalWords)} label="Words Read" icon="📖" />
        <StatBox value={String(stats.totalSessions)} label="Sessions" icon="⚡" />
        <StatBox value={`${stats.bestWpm}`} label="Best WPM" icon="🏆" highlight />
        <StatBox value={`${stats.streak}d`} label="Streak" icon="🔥" />
      </View>

      {/* WPM Chart */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>WPM Over Time</Text>
        <View style={styles.chartContainer}>
          <WPMChart data={wpmHistory} height={200} showLabels />
        </View>
      </View>

      {/* Streak Calendar */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Reading Streak</Text>
        <View style={styles.calendarContainer}>
          <StreakCalendar sessions={sessions} weeks={12} />
        </View>
      </View>

      {/* Empty state */}
      {sessions.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📊</Text>
          <Text style={styles.emptyText}>No reading sessions yet</Text>
          <Text style={styles.emptySubtext}>
            Complete a reading session to see your progress here
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

function StatBox({
  value,
  label,
  icon,
  highlight = false,
}: {
  value: string;
  label: string;
  icon: string;
  highlight?: boolean;
}) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={[styles.statValue, highlight && styles.statValueHighlight]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function formatNumber(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  content: {
    padding: Spacing.lg,
    paddingTop: 64,
    paddingBottom: 40,
    gap: Spacing.lg,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: Colors.bg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.xxl,
    fontWeight: Typography.bold,
  },
  levelCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  levelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  levelEmoji: {
    fontSize: 36,
  },
  levelTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.lg,
    fontWeight: Typography.bold,
  },
  levelSubtitle: {
    color: Colors.textMuted,
    fontSize: Typography.sm,
  },
  nextLevel: {
    marginLeft: 'auto',
    color: Colors.gold,
    fontSize: Typography.sm,
    fontWeight: Typography.medium,
  },
  levelBar: {
    height: 6,
    backgroundColor: Colors.elevated,
    borderRadius: 3,
  },
  levelBarFill: {
    height: '100%',
    backgroundColor: Colors.gold,
    borderRadius: 3,
  },
  levelBarLabel: {
    color: Colors.textMuted,
    fontSize: Typography.xs,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  statBox: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    gap: 4,
  },
  statIcon: {
    fontSize: 24,
  },
  statValue: {
    color: Colors.textPrimary,
    fontSize: Typography.xl,
    fontWeight: Typography.bold,
  },
  statValueHighlight: {
    color: Colors.gold,
  },
  statLabel: {
    color: Colors.textMuted,
    fontSize: Typography.xs,
  },
  section: {
    gap: Spacing.md,
  },
  sectionTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.md,
    fontWeight: Typography.semibold,
  },
  chartContainer: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  calendarContainer: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  emptyState: {
    alignItems: 'center',
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  emptyIcon: {
    fontSize: 48,
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: Typography.lg,
    fontWeight: Typography.medium,
  },
  emptySubtext: {
    color: Colors.textDisabled,
    fontSize: Typography.sm,
    textAlign: 'center',
  },
});
