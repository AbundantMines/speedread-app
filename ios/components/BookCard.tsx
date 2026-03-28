import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius, Shadows } from '../constants/theme';
import { GutenbergBook } from '../lib/api';

interface BookCardProps {
  book: GutenbergBook;
  onPress: (book: GutenbergBook) => void;
  isDownloading?: boolean;
  isDownloaded?: boolean;
}

export function BookCard({
  book,
  onPress,
  isDownloading = false,
  isDownloaded = false,
}: BookCardProps) {
  const author = book.authors[0]?.name || 'Unknown Author';
  const subject = book.subjects[0] || book.bookshelves[0] || '';

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress(book)}
      activeOpacity={0.7}
    >
      {/* Book spine color bar */}
      <View style={styles.spine} />

      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.textContent}>
            <Text style={styles.title} numberOfLines={2}>
              {book.title}
            </Text>
            <Text style={styles.author} numberOfLines={1}>
              {formatAuthorName(author)}
            </Text>
          </View>

          <View style={styles.actionIcon}>
            {isDownloading ? (
              <ActivityIndicator size="small" color={Colors.gold} />
            ) : isDownloaded ? (
              <Ionicons name="checkmark-circle" size={24} color={Colors.success} />
            ) : (
              <Ionicons name="download-outline" size={24} color={Colors.gold} />
            )}
          </View>
        </View>

        <View style={styles.footer}>
          {subject ? (
            <View style={styles.tag}>
              <Text style={styles.tagText} numberOfLines={1}>
                {subject.length > 30 ? subject.slice(0, 27) + '…' : subject}
              </Text>
            </View>
          ) : null}

          <View style={styles.meta}>
            <Ionicons name="download-outline" size={12} color={Colors.textDisabled} />
            <Text style={styles.metaText}>
              {formatCount(book.download_count)}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function formatAuthorName(name: string): string {
  // Gutenberg uses "Last, First" format
  if (name.includes(',')) {
    const [last, first] = name.split(',').map((s) => s.trim());
    return first ? `${first} ${last}` : last;
  }
  return name;
}

function formatCount(n: number): string {
  if (n >= 1000) return `${Math.round(n / 1000)}k`;
  return String(n);
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    ...Shadows.sm,
  },
  spine: {
    width: 4,
    backgroundColor: Colors.gold,
    opacity: 0.7,
  },
  content: {
    flex: 1,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  textContent: {
    flex: 1,
    gap: 4,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: Typography.md,
    fontWeight: Typography.semibold,
    lineHeight: 20,
  },
  author: {
    color: Colors.textMuted,
    fontSize: Typography.sm,
  },
  actionIcon: {
    padding: 4,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tag: {
    backgroundColor: Colors.elevated,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    maxWidth: '75%',
  },
  tagText: {
    color: Colors.textMuted,
    fontSize: Typography.xs,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  metaText: {
    color: Colors.textDisabled,
    fontSize: Typography.xs,
  },
});
