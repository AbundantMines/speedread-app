import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Linking,
  Alert,
  ActivityIndicator,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Colors, Typography, Spacing, Radius } from '../../constants/theme';
import { useAuth } from '../../hooks/useAuth';
import { getUserSettings, saveUserSettings, UserSettings } from '../../lib/storage';
import { getCheckoutUrl, getCustomerPortalUrl } from '../../lib/api';

export default function ProfileScreen() {
  const { user, isGuest, isPro, signOut } = useAuth();
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  useFocusEffect(
    useCallback(() => {
      getUserSettings().then(setSettings);
    }, [])
  );

  const updateSetting = async <K extends keyof UserSettings>(
    key: K,
    value: UserSettings[K]
  ) => {
    const updated = { ...settings!, [key]: value };
    setSettings(updated);
    await saveUserSettings({ [key]: value });
  };

  const handleSignOut = () => {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          setSigningOut(true);
          try {
            await signOut();
            router.replace('/auth');
          } catch {
            setSigningOut(false);
          }
        },
      },
    ]);
  };

  const handleUpgrade = () => {
    const url = getCheckoutUrl(user?.id);
    Linking.openURL(url);
  };

  const handleManageSubscription = () => {
    const url = getCustomerPortalUrl(user?.id);
    Linking.openURL(url);
  };

  if (!settings) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={Colors.gold} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <Text style={styles.headerTitle}>Profile</Text>

      {/* Account card */}
      <View style={styles.accountCard}>
        <View style={styles.accountAvatar}>
          <Text style={styles.accountAvatarText}>
            {isGuest ? '?' : (user?.email?.[0] || 'U').toUpperCase()}
          </Text>
        </View>
        <View style={styles.accountInfo}>
          <Text style={styles.accountEmail}>
            {isGuest ? 'Guest User' : user?.email || 'Unknown'}
          </Text>
          <View style={[styles.planBadge, isPro && styles.planBadgePro]}>
            <Text style={[styles.planBadgeText, isPro && styles.planBadgeTextPro]}>
              {isPro ? '⚡ Pro' : isGuest ? 'Guest' : 'Free'}
            </Text>
          </View>
        </View>
      </View>

      {/* Upgrade CTA (non-pro only) */}
      {!isPro && (
        <TouchableOpacity style={styles.upgradeCard} onPress={handleUpgrade}>
          <View>
            <Text style={styles.upgradeTitle}>Go Pro</Text>
            <Text style={styles.upgradeSubtitle}>
              Unlimited reads · Cloud sync · All 70k+ books
            </Text>
          </View>
          <View style={styles.upgradePrice}>
            <Text style={styles.upgradePriceText}>$9.99/mo</Text>
            <Ionicons name="arrow-forward" size={16} color={Colors.bg} />
          </View>
        </TouchableOpacity>
      )}

      {/* Reading settings */}
      <SectionHeader title="Reading" />

      <View style={styles.settingsGroup}>
        <SettingRow label="Default Speed" sublabel={`${settings.defaultWpm} WPM`}>
          <Slider
            style={styles.wpmSlider}
            minimumValue={50}
            maximumValue={1000}
            step={25}
            value={settings.defaultWpm}
            onSlidingComplete={(v) => updateSetting('defaultWpm', Math.round(v))}
            minimumTrackTintColor={Colors.gold}
            maximumTrackTintColor={Colors.border}
            thumbTintColor={Colors.gold}
          />
        </SettingRow>

        <Divider />

        <SettingRow label="Font Size" sublabel={`${settings.fontSize}px`}>
          <Slider
            style={styles.wpmSlider}
            minimumValue={24}
            maximumValue={72}
            step={4}
            value={settings.fontSize}
            onSlidingComplete={(v) => updateSetting('fontSize', Math.round(v))}
            minimumTrackTintColor={Colors.gold}
            maximumTrackTintColor={Colors.border}
            thumbTintColor={Colors.gold}
          />
        </SettingRow>

        <Divider />

        <SettingRow label="Dark Mode">
          <Switch
            value={settings.darkMode}
            onValueChange={(v) => updateSetting('darkMode', v)}
            trackColor={{ false: Colors.border, true: `${Colors.gold}60` }}
            thumbColor={settings.darkMode ? Colors.gold : Colors.textMuted}
          />
        </SettingRow>
      </View>

      {/* Subscription */}
      <SectionHeader title="Subscription" />

      <View style={styles.settingsGroup}>
        {isPro ? (
          <SettingButton
            icon="card-outline"
            label="Manage Subscription"
            onPress={handleManageSubscription}
          />
        ) : (
          <SettingButton
            icon="rocket-outline"
            label="Upgrade to Pro"
            onPress={handleUpgrade}
            accent
          />
        )}
      </View>

      {/* About */}
      <SectionHeader title="About" />

      <View style={styles.settingsGroup}>
        <SettingButton
          icon="globe-outline"
          label="Website"
          onPress={() => Linking.openURL('https://warpreader.com')}
        />
        <Divider />
        <SettingButton
          icon="shield-checkmark-outline"
          label="Privacy Policy"
          onPress={() => Linking.openURL('https://warpreader.com/privacy')}
        />
        <Divider />
        <SettingButton
          icon="document-text-outline"
          label="Terms of Service"
          onPress={() => Linking.openURL('https://warpreader.com/terms')}
        />
      </View>

      {/* Account actions */}
      {!isGuest && (
        <>
          <SectionHeader title="Account" />
          <View style={styles.settingsGroup}>
            <TouchableOpacity
              style={styles.signOutBtn}
              onPress={handleSignOut}
              disabled={signingOut}
            >
              {signingOut ? (
                <ActivityIndicator color={Colors.error} size="small" />
              ) : (
                <Ionicons name="log-out-outline" size={18} color={Colors.error} />
              )}
              <Text style={styles.signOutText}>Sign Out</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {isGuest && (
        <TouchableOpacity
          style={styles.signInPrompt}
          onPress={() => router.replace('/auth')}
        >
          <Ionicons name="person-outline" size={18} color={Colors.gold} />
          <Text style={styles.signInPromptText}>Sign in to sync your progress</Text>
          <Ionicons name="arrow-forward" size={16} color={Colors.gold} />
        </TouchableOpacity>
      )}

      <Text style={styles.version}>Warpreader v1.0.0</Text>
    </ScrollView>
  );
}

function SectionHeader({ title }: { title: string }) {
  return <Text style={styles.sectionHeader}>{title}</Text>;
}

function Divider() {
  return <View style={styles.divider} />;
}

function SettingRow({
  label,
  sublabel,
  children,
}: {
  label: string;
  sublabel?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.settingRow}>
      <View style={styles.settingLabel}>
        <Text style={styles.settingLabelText}>{label}</Text>
        {sublabel && <Text style={styles.settingSubLabel}>{sublabel}</Text>}
      </View>
      <View style={styles.settingControl}>{children}</View>
    </View>
  );
}

function SettingButton({
  icon,
  label,
  onPress,
  accent = false,
}: {
  icon: string;
  label: string;
  onPress: () => void;
  accent?: boolean;
}) {
  return (
    <TouchableOpacity style={styles.settingButton} onPress={onPress} activeOpacity={0.7}>
      <Ionicons
        name={icon as any}
        size={18}
        color={accent ? Colors.gold : Colors.textMuted}
      />
      <Text style={[styles.settingButtonText, accent && styles.settingButtonTextAccent]}>
        {label}
      </Text>
      <Ionicons name="chevron-forward" size={16} color={Colors.textDisabled} />
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
    paddingBottom: 60,
    gap: Spacing.md,
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
    marginBottom: Spacing.sm,
  },
  accountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  accountAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: `${Colors.gold}30`,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.gold,
  },
  accountAvatarText: {
    color: Colors.gold,
    fontSize: Typography.xl,
    fontWeight: Typography.bold,
  },
  accountInfo: {
    flex: 1,
    gap: Spacing.xs,
  },
  accountEmail: {
    color: Colors.textPrimary,
    fontSize: Typography.md,
    fontWeight: Typography.medium,
  },
  planBadge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.elevated,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  planBadgePro: {
    backgroundColor: `${Colors.gold}20`,
    borderColor: Colors.gold,
  },
  planBadgeText: {
    color: Colors.textMuted,
    fontSize: Typography.xs,
    fontWeight: Typography.medium,
  },
  planBadgeTextPro: {
    color: Colors.gold,
  },
  upgradeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.gold,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
  },
  upgradeTitle: {
    color: Colors.bg,
    fontSize: Typography.lg,
    fontWeight: Typography.bold,
  },
  upgradeSubtitle: {
    color: `${Colors.bg}cc`,
    fontSize: Typography.sm,
    marginTop: 2,
  },
  upgradePrice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  upgradePriceText: {
    color: Colors.bg,
    fontSize: Typography.md,
    fontWeight: Typography.bold,
  },
  sectionHeader: {
    color: Colors.textMuted,
    fontSize: Typography.sm,
    fontWeight: Typography.semibold,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: Spacing.sm,
    marginBottom: -Spacing.xs,
  },
  settingsGroup: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    gap: Spacing.md,
  },
  settingLabel: {
    flex: 1,
    gap: 2,
  },
  settingLabelText: {
    color: Colors.textPrimary,
    fontSize: Typography.md,
  },
  settingSubLabel: {
    color: Colors.gold,
    fontSize: Typography.xs,
  },
  settingControl: {
    alignItems: 'flex-end',
    minWidth: 100,
  },
  wpmSlider: {
    width: 130,
    height: 36,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginLeft: Spacing.md,
  },
  settingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    gap: Spacing.md,
  },
  settingButtonText: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: Typography.md,
  },
  settingButtonTextAccent: {
    color: Colors.gold,
    fontWeight: Typography.medium,
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    gap: Spacing.md,
  },
  signOutText: {
    color: Colors.error,
    fontSize: Typography.md,
  },
  signInPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${Colors.gold}15`,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: `${Colors.gold}30`,
  },
  signInPromptText: {
    flex: 1,
    color: Colors.gold,
    fontSize: Typography.md,
  },
  version: {
    color: Colors.textDisabled,
    fontSize: Typography.xs,
    textAlign: 'center',
    marginTop: Spacing.lg,
  },
});
