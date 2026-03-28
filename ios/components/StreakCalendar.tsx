import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Colors, Typography, Spacing, Radius } from '../constants/theme';

interface StreakCalendarProps {
  sessions: { createdAt: string }[];
  weeks?: number;
}

export function StreakCalendar({ sessions, weeks = 12 }: StreakCalendarProps) {
  const calendarData = useMemo(() => {
    // Build a set of dates with sessions
    const sessionDates = new Set(
      sessions.map((s) => {
        const d = new Date(s.createdAt);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      })
    );

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Go back 'weeks' worth of days
    const totalDays = weeks * 7;
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - totalDays + 1);

    // Align to Sunday
    const dayOfWeek = startDate.getDay();
    startDate.setDate(startDate.getDate() - dayOfWeek);

    const grid: { date: Date; hasSession: boolean; isToday: boolean; isFuture: boolean }[][] = [];
    let current = new Date(startDate);

    for (let w = 0; w < weeks; w++) {
      const week: { date: Date; hasSession: boolean; isToday: boolean; isFuture: boolean }[] = [];
      for (let d = 0; d < 7; d++) {
        const dateKey = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`;
        week.push({
          date: new Date(current),
          hasSession: sessionDates.has(dateKey),
          isToday: current.getTime() === today.getTime(),
          isFuture: current > today,
        });
        current.setDate(current.getDate() + 1);
      }
      grid.push(week);
    }

    return grid;
  }, [sessions, weeks]);

  const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  return (
    <View style={styles.container}>
      {/* Day labels */}
      <View style={styles.dayLabels}>
        {dayLabels.map((label, i) => (
          <Text key={i} style={styles.dayLabel}>
            {label}
          </Text>
        ))}
      </View>

      {/* Grid */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.grid}>
          {calendarData.map((week, wi) => (
            <View key={wi} style={styles.week}>
              {week.map((day, di) => (
                <View
                  key={di}
                  style={[
                    styles.cell,
                    day.hasSession && styles.cellActive,
                    day.isToday && styles.cellToday,
                    day.isFuture && styles.cellFuture,
                  ]}
                />
              ))}
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Legend */}
      <View style={styles.legend}>
        <Text style={styles.legendText}>Less</Text>
        <View style={[styles.cell, styles.cellInactive]} />
        <View style={[styles.cell, styles.cellLow]} />
        <View style={[styles.cell, styles.cellMid]} />
        <View style={[styles.cell, styles.cellActive]} />
        <Text style={styles.legendText}>More</Text>
      </View>
    </View>
  );
}

const CELL_SIZE = 14;
const CELL_GAP = 3;

const styles = StyleSheet.create({
  container: {
    gap: Spacing.sm,
  },
  dayLabels: {
    flexDirection: 'column',
    gap: CELL_GAP,
    position: 'absolute',
    left: 0,
    top: 0,
  },
  dayLabel: {
    color: Colors.textMuted,
    fontSize: 9,
    width: CELL_SIZE,
    height: CELL_SIZE,
    textAlign: 'center',
    lineHeight: CELL_SIZE,
  },
  grid: {
    flexDirection: 'row',
    gap: CELL_GAP,
    paddingLeft: CELL_SIZE + CELL_GAP,
  },
  week: {
    flexDirection: 'column',
    gap: CELL_GAP,
  },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderRadius: 3,
    backgroundColor: Colors.elevated,
  },
  cellInactive: {
    backgroundColor: Colors.elevated,
  },
  cellLow: {
    backgroundColor: `${Colors.gold}40`,
  },
  cellMid: {
    backgroundColor: `${Colors.gold}80`,
  },
  cellActive: {
    backgroundColor: Colors.gold,
  },
  cellToday: {
    borderWidth: 2,
    borderColor: Colors.goldLight,
  },
  cellFuture: {
    opacity: 0.2,
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    justifyContent: 'flex-end',
  },
  legendText: {
    color: Colors.textMuted,
    fontSize: Typography.xs,
  },
});
