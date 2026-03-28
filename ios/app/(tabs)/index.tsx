import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Modal,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import { Colors, Typography, Spacing, Radius, Shadows } from '../../constants/theme';
import { useAuth } from '../../hooks/useAuth';
import { useSync } from '../../hooks/useSync';
import {
  getSavedDocuments,
  getReadingSessions,
  getGuestDocsToday,
  incrementGuestDocs,
  getWpmHistory,
  saveDocument,
  calculateStreak,
  LocalDocument,
} from '../../lib/storage';
import { WPMChart } from '../../components/WPMChart';
import { tokenizeText } from '../../lib/rsvp';

export default function HomeScreen() {
  const { user, isGuest, isPro } = useAuth();
  const { syncAll } = useSync(user?.id);

  const [documents, setDocuments] = useState<LocalDocument[]>([]);
  const [wpmHistory, setWpmHistory] = useState<{ date: string; wpm: number }[]>([]);
  const [streak, setStreak] = useState(0);
  const [guestDocsToday, setGuestDocsToday] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modals
  const [pasteModal, setPasteModal] = useState(false);
  const [urlModal, setUrlModal] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [urlLoading, setUrlLoading] = useState(false);

  const loadData = useCallback(async () => {
    const [docs, sessions, history, guestCount] = await Promise.all([
      getSavedDocuments(),
      getReadingSessions(),
      getWpmHistory(),
      getGuestDocsToday(),
    ]);
    setDocuments(docs.slice(0, 5));
    setWpmHistory(history.slice(0, 10).reverse());
    setStreak(calculateStreak(sessions));
    setGuestDocsToday(guestCount);
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

  const canStartReading = () => {
    if (isPro || user) return true;
    return guestDocsToday < 3;
  };

  const openReader = (doc: LocalDocument) => {
    router.push({
      pathname: '/reader',
      params: {
        documentId: doc.id,
        title: doc.title,
        content: doc.content,
        startIndex: String(Math.round((doc.readingProgress || 0) * tokenizeText(doc.content).length)),
      },
    });
  };

  const handleUploadPDF = async () => {
    if (!canStartReading()) {
      Alert.alert('Daily limit reached', 'Upgrade to Pro for unlimited reading.', [
        { text: 'Upgrade', onPress: () => router.push('/(tabs)/profile') },
        { text: 'Cancel', style: 'cancel' },
      ]);
      return;
    }

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'text/*',
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      // For text files, read content
      const response = await fetch(asset.uri);
      const content = await response.text();

      const doc: LocalDocument = {
        id: `doc_${Date.now()}`,
        title: asset.name.replace(/\.[^/.]+$/, ''),
        content,
        wordCount: tokenizeText(content).length,
        createdAt: new Date().toISOString(),
        readingProgress: 0,
        synced: false,
      };

      await saveDocument(doc);
      await incrementGuestDocs();
      await loadData();
      openReader(doc);
    } catch (err: any) {
      Alert.alert('Import failed', err.message || 'Could not read that file.');
    }
  };

  const handlePasteText = async () => {
    if (!canStartReading()) {
      Alert.alert('Daily limit reached', 'Upgrade to Pro for unlimited reading.');
      return;
    }
    setPasteModal(true);
  };

  const submitPasteText = async () => {
    if (!pasteText.trim()) return;

    const doc: LocalDocument = {
      id: `doc_${Date.now()}`,
      title: 'Pasted text',
      content: pasteText.trim(),
      wordCount: tokenizeText(pasteText.trim()).length,
      createdAt: new Date().toISOString(),
      readingProgress: 0,
      synced: false,
    };

    await saveDocument(doc);
    await incrementGuestDocs();
    setPasteModal(false);
    setPasteText('');
    await loadData();
    openReader(doc);
  };

  const handleUrlInput = async () => {
    if (!canStartReading()) {
      Alert.alert('Daily limit reached', 'Upgrade to Pro for unlimited reading.');
      return;
    }
    setUrlModal(true);
  };

  const submitUrl = async () => {
    if (!urlInput.trim()) return;
    setUrlLoading(true);

    try {
      const { extractArticleText } = await import('../../lib/api');
      const content = await extractArticleText(urlInput.trim());
      const title = urlInput.trim().split('/').filter(Boolean).pop() || 'Article';

      const doc: LocalDocument = {
        id: `doc_${Date.now()}`,
        title,
        content,
        wordCount: tokenizeText(content).length,
        sourceUrl: urlInput.trim(),
        createdAt: new Date().toISOString(),
        readingProgress: 0,
        synced: false,
      };

      await saveDocument(doc);
      await incrementGuestDocs();
      setUrlModal(false);
      setUrlInput('');
      await loadData();
      openReader(doc);
    } catch (err: any) {
      Alert.alert('Could not fetch article', err.message || 'Check the URL and try again.');
    } finally {
      setUrlLoading(false);
    }
  };

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
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>
            {user ? `Hey, ${user.email?.split('@')[0]}` : 'Warpreader'}
          </Text>
          <Text style={styles.subGreeting}>
            {streak > 0 ? `🔥 ${streak} day streak` : 'Ready to read?'}
          </Text>
        </View>
        {isGuest && !isPro && (
          <View style={styles.guestBadge}>
            <Text style={styles.guestBadgeText}>{3 - guestDocsToday} left today</Text>
          </View>
        )}
      </View>

      {/* Hero card */}
      <TouchableOpacity
        style={styles.heroCard}
        onPress={() => {
          if (documents.length > 0) {
            openReader(documents[0]);
          } else {
            setPasteModal(true);
          }
        }}
        activeOpacity={0.85}
      >
        <View>
          <Text style={styles.heroTitle}>
            {documents.length > 0 ? 'Continue Reading' : 'Start Reading'}
          </Text>
          <Text style={styles.heroSubtitle}>
            {documents.length > 0
              ? documents[0].title
              : 'Paste text, upload a file, or browse the library'}
          </Text>
          {documents.length > 0 && (
            <View style={styles.progressBarContainer}>
              <View
                style={[
                  styles.progressBarFill,
                  { width: `${Math.round((documents[0].readingProgress || 0) * 100)}%` },
                ]}
              />
            </View>
          )}
        </View>
        <View style={styles.heroIcon}>
          <Ionicons name="flash" size={28} color={Colors.bg} />
        </View>
      </TouchableOpacity>

      {/* Quick actions */}
      <Text style={styles.sectionTitle}>Import</Text>
      <View style={styles.quickActions}>
        <QuickAction icon="document-text-outline" label="Paste Text" onPress={handlePasteText} />
        <QuickAction icon="cloud-upload-outline" label="Upload File" onPress={handleUploadPDF} />
        <QuickAction icon="link-outline" label="From URL" onPress={handleUrlInput} />
        <QuickAction icon="library-outline" label="Browse Library" onPress={() => router.push('/(tabs)/library')} />
      </View>

      {/* WPM mini chart */}
      {wpmHistory.length > 1 && (
        <View style={styles.wpmCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Your Speed</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/progress')}>
              <Text style={styles.seeAll}>See all →</Text>
            </TouchableOpacity>
          </View>
          <WPMChart data={wpmHistory} height={100} showLabels={false} mini />
          {wpmHistory.length > 0 && (
            <Text style={styles.wpmCurrent}>
              {wpmHistory[wpmHistory.length - 1].wpm} WPM last session
            </Text>
          )}
        </View>
      )}

      {/* Recent documents */}
      {documents.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Recent</Text>
          <View style={styles.docList}>
            {documents.map((doc) => (
              <TouchableOpacity
                key={doc.id}
                style={styles.docCard}
                onPress={() => openReader(doc)}
                activeOpacity={0.7}
              >
                <View style={styles.docIcon}>
                  <Ionicons name="document-text" size={20} color={Colors.gold} />
                </View>
                <View style={styles.docInfo}>
                  <Text style={styles.docTitle} numberOfLines={1}>
                    {doc.title}
                  </Text>
                  <Text style={styles.docMeta}>
                    {doc.wordCount.toLocaleString()} words ·{' '}
                    {Math.round((doc.readingProgress || 0) * 100)}% read
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={Colors.textDisabled} />
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}

      {/* Paste text modal */}
      <Modal visible={pasteModal} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Paste Text</Text>
            <TouchableOpacity onPress={() => { setPasteModal(false); setPasteText(''); }}>
              <Ionicons name="close" size={24} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>
          <TextInput
            style={styles.pasteInput}
            multiline
            value={pasteText}
            onChangeText={setPasteText}
            placeholder="Paste or type text here..."
            placeholderTextColor={Colors.textDisabled}
            autoFocus
          />
          <View style={styles.modalFooter}>
            <Text style={styles.wordCountHint}>
              {tokenizeText(pasteText).length} words
            </Text>
            <TouchableOpacity
              style={[styles.readBtn, !pasteText.trim() && styles.readBtnDisabled]}
              onPress={submitPasteText}
              disabled={!pasteText.trim()}
            >
              <Text style={styles.readBtnText}>Read Now</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* URL modal */}
      <Modal visible={urlModal} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Article URL</Text>
            <TouchableOpacity onPress={() => { setUrlModal(false); setUrlInput(''); }}>
              <Ionicons name="close" size={24} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>
          <TextInput
            style={styles.urlInput}
            value={urlInput}
            onChangeText={setUrlInput}
            placeholder="https://example.com/article"
            placeholderTextColor={Colors.textDisabled}
            autoCapitalize="none"
            keyboardType="url"
            autoFocus
          />
          <View style={styles.modalFooter}>
            <View />
            <TouchableOpacity
              style={[styles.readBtn, (!urlInput.trim() || urlLoading) && styles.readBtnDisabled]}
              onPress={submitUrl}
              disabled={!urlInput.trim() || urlLoading}
            >
              {urlLoading ? (
                <ActivityIndicator color={Colors.bg} size="small" />
              ) : (
                <Text style={styles.readBtnText}>Fetch & Read</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function QuickAction({
  icon,
  label,
  onPress,
}: {
  icon: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.quickAction} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.quickActionIcon}>
        <Ionicons name={icon as any} size={22} color={Colors.gold} />
      </View>
      <Text style={styles.quickActionLabel}>{label}</Text>
    </TouchableOpacity>
  );
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
    gap: Spacing.md,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: Colors.bg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  greeting: {
    color: Colors.textPrimary,
    fontSize: Typography.xl,
    fontWeight: Typography.bold,
  },
  subGreeting: {
    color: Colors.textMuted,
    fontSize: Typography.sm,
    marginTop: 2,
  },
  guestBadge: {
    backgroundColor: `${Colors.gold}20`,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderWidth: 1,
    borderColor: `${Colors.gold}40`,
  },
  guestBadgeText: {
    color: Colors.gold,
    fontSize: Typography.xs,
    fontWeight: Typography.semibold,
  },
  heroCard: {
    backgroundColor: Colors.gold,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    ...Shadows.gold,
  },
  heroTitle: {
    color: Colors.bg,
    fontSize: Typography.lg,
    fontWeight: Typography.bold,
    marginBottom: 4,
  },
  heroSubtitle: {
    color: `${Colors.bg}cc`,
    fontSize: Typography.sm,
    maxWidth: 240,
  },
  progressBarContainer: {
    marginTop: Spacing.sm,
    height: 3,
    backgroundColor: `${Colors.bg}30`,
    borderRadius: 2,
    width: 200,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: Colors.bg,
    borderRadius: 2,
  },
  heroIcon: {
    width: 52,
    height: 52,
    borderRadius: Radius.full,
    backgroundColor: `${Colors.bg}30`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.md,
    fontWeight: Typography.semibold,
    marginBottom: Spacing.sm,
  },
  seeAll: {
    color: Colors.gold,
    fontSize: Typography.sm,
  },
  quickActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  quickAction: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    alignItems: 'center',
    gap: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  quickActionIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    backgroundColor: `${Colors.gold}15`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickActionLabel: {
    color: Colors.textMuted,
    fontSize: 11,
    textAlign: 'center',
  },
  wpmCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.sm,
  },
  wpmCurrent: {
    color: Colors.textMuted,
    fontSize: Typography.sm,
  },
  docList: {
    gap: Spacing.sm,
  },
  docCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  docIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    backgroundColor: `${Colors.gold}15`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  docInfo: {
    flex: 1,
    gap: 3,
  },
  docTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.md,
    fontWeight: Typography.medium,
  },
  docMeta: {
    color: Colors.textMuted,
    fontSize: Typography.sm,
  },
  // Modals
  modal: {
    flex: 1,
    backgroundColor: Colors.bg,
    padding: Spacing.lg,
    paddingTop: Spacing.xl,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  modalTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.xl,
    fontWeight: Typography.bold,
  },
  pasteInput: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: Typography.md,
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    textAlignVertical: 'top',
    lineHeight: 24,
  },
  urlInput: {
    color: Colors.textPrimary,
    fontSize: Typography.md,
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  wordCountHint: {
    color: Colors.textMuted,
    fontSize: Typography.sm,
  },
  readBtn: {
    backgroundColor: Colors.gold,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  readBtnDisabled: {
    opacity: 0.4,
  },
  readBtnText: {
    color: Colors.bg,
    fontSize: Typography.md,
    fontWeight: Typography.bold,
  },
});
