import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Svg, { Path, Circle, Line, Text as SvgText, Defs, LinearGradient, Stop } from 'react-native-svg';
import { Colors, Typography, Spacing } from '../constants/theme';

interface WpmDataPoint {
  date: string;
  wpm: number;
}

interface WPMChartProps {
  data: WpmDataPoint[];
  height?: number;
  showLabels?: boolean;
  mini?: boolean;
}

export function WPMChart({ data, height = 180, showLabels = true, mini = false }: WPMChartProps) {
  const width = Dimensions.get('window').width - (mini ? 32 : 64);
  const paddingLeft = mini ? 0 : 40;
  const paddingRight = 16;
  const paddingTop = 16;
  const paddingBottom = showLabels ? 32 : 8;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const { path, gradientPath, dots, minWpm, maxWpm, yLabels, xLabels } = useMemo(() => {
    if (data.length === 0) {
      return { path: '', gradientPath: '', dots: [], minWpm: 0, maxWpm: 500, yLabels: [], xLabels: [] };
    }

    const wpms = data.map((d) => d.wpm);
    const minWpm = Math.max(0, Math.min(...wpms) - 50);
    const maxWpm = Math.max(...wpms) + 50;
    const range = maxWpm - minWpm || 1;

    const toX = (i: number) =>
      paddingLeft + (i / Math.max(data.length - 1, 1)) * chartWidth;
    const toY = (wpm: number) =>
      paddingTop + chartHeight - ((wpm - minWpm) / range) * chartHeight;

    let path = '';
    let gradientPath = '';
    const dots: { x: number; y: number; wpm: number }[] = [];

    data.forEach((d, i) => {
      const x = toX(i);
      const y = toY(d.wpm);
      dots.push({ x, y, wpm: d.wpm });

      if (i === 0) {
        path += `M ${x} ${y}`;
        gradientPath += `M ${x} ${y}`;
      } else {
        // Smooth curve
        const prevX = toX(i - 1);
        const prevY = toY(data[i - 1].wpm);
        const cpX = (prevX + x) / 2;
        path += ` C ${cpX} ${prevY}, ${cpX} ${y}, ${x} ${y}`;
        gradientPath += ` C ${cpX} ${prevY}, ${cpX} ${y}, ${x} ${y}`;
      }
    });

    // Close gradient path
    const lastX = toX(data.length - 1);
    const bottomY = paddingTop + chartHeight;
    gradientPath += ` L ${lastX} ${bottomY} L ${paddingLeft} ${bottomY} Z`;

    // Y labels
    const yLabels = [
      { y: toY(minWpm), label: String(Math.round(minWpm)) },
      { y: toY((minWpm + maxWpm) / 2), label: String(Math.round((minWpm + maxWpm) / 2)) },
      { y: toY(maxWpm), label: String(Math.round(maxWpm)) },
    ];

    // X labels: show first, middle, last date
    const xLabels = [
      { x: toX(0), label: formatDate(data[0].date) },
      { x: toX(data.length - 1), label: formatDate(data[data.length - 1].date) },
    ];

    return { path, gradientPath, dots, minWpm, maxWpm, yLabels, xLabels };
  }, [data, chartWidth, chartHeight, paddingLeft, paddingTop]);

  if (data.length === 0) {
    return (
      <View style={[styles.empty, { height }]}>
        <Text style={styles.emptyText}>No reading data yet</Text>
        <Text style={styles.emptySubtext}>Complete a reading session to see your progress</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id="wpmGradient" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={Colors.gold} stopOpacity={0.3} />
            <Stop offset="100%" stopColor={Colors.gold} stopOpacity={0} />
          </LinearGradient>
        </Defs>

        {/* Grid lines */}
        {!mini && yLabels.map((l, i) => (
          <Line
            key={i}
            x1={paddingLeft}
            y1={l.y}
            x2={width - paddingRight}
            y2={l.y}
            stroke={Colors.border}
            strokeWidth={1}
            strokeDasharray="4 4"
          />
        ))}

        {/* Gradient fill */}
        <Path d={gradientPath} fill="url(#wpmGradient)" />

        {/* Line */}
        <Path
          d={path}
          fill="none"
          stroke={Colors.gold}
          strokeWidth={mini ? 1.5 : 2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Dots */}
        {!mini && dots.map((dot, i) => (
          <Circle
            key={i}
            cx={dot.x}
            cy={dot.y}
            r={i === dots.length - 1 ? 5 : 3}
            fill={i === dots.length - 1 ? Colors.gold : Colors.goldDark}
          />
        ))}

        {/* Y axis labels */}
        {showLabels && !mini && yLabels.map((l, i) => (
          <SvgText
            key={i}
            x={paddingLeft - 8}
            y={l.y + 4}
            fill={Colors.textMuted}
            fontSize={10}
            textAnchor="end"
          >
            {l.label}
          </SvgText>
        ))}

        {/* X axis labels */}
        {showLabels && !mini && xLabels.map((l, i) => (
          <SvgText
            key={i}
            x={l.x}
            y={height - 4}
            fill={Colors.textMuted}
            fontSize={10}
            textAnchor={i === 0 ? 'start' : 'end'}
          >
            {l.label}
          </SvgText>
        ))}
      </Svg>
    </View>
  );
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: Typography.md,
    fontWeight: Typography.medium,
  },
  emptySubtext: {
    color: Colors.textDisabled,
    fontSize: Typography.sm,
    textAlign: 'center',
  },
});
