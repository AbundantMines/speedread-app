import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { WordParts } from '../lib/rsvp';
import { Colors, Typography } from '../constants/theme';

interface RSVPWordProps {
  parts: WordParts;
  fontSize?: number;
  isDark?: boolean;
}

export function RSVPWord({ parts, fontSize = 42, isDark = true }: RSVPWordProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  useEffect(() => {
    // Quick fade+scale in on each new word
    fadeAnim.setValue(0);
    scaleAnim.setValue(0.95);
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 60,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 200,
        friction: 12,
        useNativeDriver: true,
      }),
    ]).start();
  }, [parts.before, parts.orpChar, parts.after]);

  const textColor = isDark ? Colors.textPrimary : Colors.lightText;

  return (
    <Animated.View
      style={[
        styles.container,
        { opacity: fadeAnim, transform: [{ scale: scaleAnim }] },
      ]}
    >
      {/* ORP alignment guide line */}
      <View style={styles.orpGuide} />

      <View style={styles.wordRow}>
        {/* Before ORP */}
        <Text
          style={[
            styles.wordText,
            styles.beforeText,
            { fontSize, color: textColor },
          ]}
          numberOfLines={1}
        >
          {parts.before}
        </Text>

        {/* ORP letter — gold highlight */}
        <Text
          style={[
            styles.wordText,
            styles.orpText,
            { fontSize },
          ]}
          numberOfLines={1}
        >
          {parts.orpChar}
        </Text>

        {/* After ORP */}
        <Text
          style={[
            styles.wordText,
            styles.afterText,
            { fontSize, color: textColor },
          ]}
          numberOfLines={1}
        >
          {parts.after}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingHorizontal: 20,
  },
  orpGuide: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: Colors.gold,
    opacity: 0.15,
    // Positioned at ~30% from left to align with ORP
    left: '30%',
  },
  wordRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
  },
  wordText: {
    fontFamily: 'System',
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  beforeText: {
    textAlign: 'right',
  },
  orpText: {
    color: Colors.gold,
    fontWeight: '700',
  },
  afterText: {
    textAlign: 'left',
  },
});
