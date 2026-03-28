import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius } from '../../constants/theme';
import { BookCard } from '../../components/BookCard';
import {
  searchGutenberg,
  getGutenbergByCategory,
  downloadGutenbergBook,
  GutenbergBook,
} from '../../lib/api';
import {
  getSavedDocuments,
  saveDocument,
  LocalDocument,
} from '../../lib/storage';
import { tokenizeText } from '../../lib/rsvp';
import { useFocusEffect } from '@react-navigation/native';

const CATEGORIES = [
  { id: 'philosophy', label: 'Philosophy', icon: '🧠' },
  { id: 'economics', label: 'Economics', icon: '📈' },
  { id: 'strategy', label: 'Strategy', icon: '♟️' },
  { id: 'biography', label: 'Biographies', icon: '👤' },
  { id: 'psychology', label: 'Psychology', icon: '🧬' },
];

export default function LibraryScreen() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GutenbergBook[]>([]);
  const [searching, setSearching] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<Set<number>>(new Set());
  const [downloaded, setDownloaded] = useState<Set<number>>(new Set());
  const [myDocs, setMyDocs] = useState<LocalDocument[]>([]);
  const [searchPage, setSearchPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  useFocusEffect(
    useCallback(() => {
      getSavedDocuments().then(setMyDocs);
      // Load default category
      loadCategory('philosophy');
    }, [])
  );

  const loadCategory = async (categoryId: string) => {
    setActiveCategory(categoryId);
    setQuery('');
    setSearching(true);
    setResults([]);
    setSearchPage(1);

    try {
      const data = await getGutenbergByCategory(categoryId);
      setResults(data.results);
      setHasMore(!!data.next);
    } catch (err) {
      console.warn('Category load failed:', err);
    } finally {
      setSearching(false);
    }
  };

  const handleSearch = async (text?: string) => {
    const q = text ?? query;
    if (!q.trim()) return;

    setActiveCategory(null);
    setSearching(true);
    setResults([]);
    setSearchPage(1);

    try {
      const data = await searchGutenberg(q.trim());
      setResults(data.results);
      setHasMore(!!data.next);
    } catch (err) {
      Alert.alert('Search failed', 'Check your connection and try again.');
    } finally {
      setSearching(false);
    }
  };

  const loadMore = async () => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    const nextPage = searchPage + 1;

    try {
      const data = activeCategory
        ? await getGutenbergByCategory(activeCategory)
        : await searchGutenberg(query, nextPage);
      setResults((prev) => [...prev, ...data.results]);
      setHasMore(!!data.next);
      setSearchPage(nextPage);
    } catch {
      // ignore
    } finally {
      setLoadingMore(false);
    }
  };

  const handleBookPress = async (book: GutenbergBook) => {
    if (downloading.has(book.id)) return;

    // Check if already downloaded
    const existingDoc = myDocs.find((d) => d.sourceUrl?.includes(String(book.id)));
    if (existingDoc) {
      router.push({
        pathname: '/reader',
        params: {
          documentId: existingDoc.id,
          title: existingDoc.title,
          content: existingDoc.content,
          startIndex: String(Math.round((existingDoc.readingProgress || 0) * tokenizeText(existingDoc.content).length)),
        },
      });
      return;
    }

    setDownloading((s) => new Set([...s, book.id]));

    try {
      const content = await downloadGutenbergBook(book);
      const author = book.authors[0]?.name || 'Unknown';

      const doc: LocalDocument = {
        id: `gutenberg_${book.id}`,
        title: book.title,
        content,
        wordCount: tokenizeText(content).length,
        sourceUrl: `https://www.gutenberg.org/ebooks/${book.id}`,
        createdAt: new Date().toISOString(),
        readingProgress: 0,
        synced: false,
      };

      await saveDocument(doc);
      setDownloaded((s) => new Set([...s, book.id]));
      setMyDocs((prev) => [doc, ...prev]);

      router.push({
        pathname: '/reader',
        params: {
          documentId: doc.id,
          title: doc.title,
          content: doc.content,
          startIndex: '0',
        },
      });
    } catch (err: any) {
      Alert.alert('Download failed', err.message || 'Could not download this book.');
    } finally {
      setDownloading((s) => {
        const next = new Set(s);
        next.delete(book.id);
        return next;
      });
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Library</Text>

        {/* Search */}
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color={Colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Search 70,000+ books..."
            placeholderTextColor={Colors.textDisabled}
            onSubmitEditing={() => handleSearch()}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => { setQuery(''); setResults([]); }}>
              <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Categories */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categories}
          contentContainerStyle={styles.categoriesContent}
        >
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              style={[styles.categoryChip, activeCategory === cat.id && styles.categoryChipActive]}
              onPress={() => loadCategory(cat.id)}
            >
              <Text style={styles.categoryEmoji}>{cat.icon}</Text>
              <Text
                style={[
                  styles.categoryLabel,
                  activeCategory === cat.id && styles.categoryLabelActive,
                ]}
              >
                {cat.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={results}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          myDocs.length > 0 ? (
            <View style={styles.myBooksSection}>
              <Text style={styles.sectionTitle}>My Books</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.myBooksList}>
                  {myDocs.map((doc) => (
                    <TouchableOpacity
                      key={doc.id}
                      style={styles.myBookCard}
                      onPress={() =>
                        router.push({
                          pathname: '/reader',
                          params: {
                            documentId: doc.id,
                            title: doc.title,
                            content: doc.content,
                            startIndex: String(
                              Math.round(
                                (doc.readingProgress || 0) *
                                  tokenizeText(doc.content).length
                              )
                            ),
                          },
                        })
                      }
                    >
                      <View style={styles.myBookSpine} />
                      <Text style={styles.myBookTitle} numberOfLines={2}>
                        {doc.title}
                      </Text>
                      <Text style={styles.myBookProgress}>
                        {Math.round((doc.readingProgress || 0) * 100)}%
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>
          ) : null
        }
        ListEmptyComponent={
          searching ? (
            <View style={styles.loadingState}>
              <ActivityIndicator color={Colors.gold} size="large" />
              <Text style={styles.loadingText}>Loading books...</Text>
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>📚</Text>
              <Text style={styles.emptyText}>Search for a book or pick a category</Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <BookCard
            book={item}
            onPress={handleBookPress}
            isDownloading={downloading.has(item.id)}
            isDownloaded={
              downloaded.has(item.id) ||
              myDocs.some((d) => d.sourceUrl?.includes(String(item.id)))
            }
          />
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          loadingMore ? (
            <ActivityIndicator color={Colors.gold} style={styles.loadingMore} />
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    gap: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.xxl,
    fontWeight: Typography.bold,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: Typography.md,
    paddingVertical: Spacing.md,
  },
  categories: {
    marginHorizontal: -Spacing.lg,
  },
  categoriesContent: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    gap: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  categoryChipActive: {
    backgroundColor: `${Colors.gold}20`,
    borderColor: Colors.gold,
  },
  categoryEmoji: {
    fontSize: 14,
  },
  categoryLabel: {
    color: Colors.textMuted,
    fontSize: Typography.sm,
  },
  categoryLabelActive: {
    color: Colors.gold,
    fontWeight: Typography.semibold,
  },
  list: {
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  separator: {
    height: Spacing.sm,
  },
  myBooksSection: {
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  sectionTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.md,
    fontWeight: Typography.semibold,
  },
  myBooksList: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  myBookCard: {
    width: 100,
    height: 130,
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    padding: Spacing.sm,
    gap: 4,
  },
  myBookSpine: {
    height: 3,
    backgroundColor: Colors.gold,
    borderRadius: 2,
    width: '100%',
    marginBottom: 4,
  },
  myBookTitle: {
    color: Colors.textPrimary,
    fontSize: 11,
    flex: 1,
  },
  myBookProgress: {
    color: Colors.gold,
    fontSize: 10,
    fontWeight: Typography.semibold,
  },
  loadingState: {
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.md,
  },
  loadingText: {
    color: Colors.textMuted,
    fontSize: Typography.md,
  },
  emptyState: {
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.md,
  },
  emptyIcon: {
    fontSize: 48,
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: Typography.md,
    textAlign: 'center',
  },
  loadingMore: {
    padding: Spacing.lg,
  },
});
