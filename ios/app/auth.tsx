import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius } from '../constants/theme';
import { useAuth } from '../hooks/useAuth';

type AuthMode = 'login' | 'signup' | 'forgot';

export default function AuthScreen() {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { signIn, signUp, resetPassword, continueAsGuest } = useAuth();

  const handleSubmit = async () => {
    if (!email.trim()) {
      setError('Enter your email');
      return;
    }
    if (mode !== 'forgot' && !password) {
      setError('Enter your password');
      return;
    }

    setError('');
    setLoading(true);

    try {
      if (mode === 'login') {
        await signIn(email.trim(), password);
        router.replace('/(tabs)');
      } else if (mode === 'signup') {
        if (password.length < 6) {
          setError('Password must be at least 6 characters');
          return;
        }
        await signUp(email.trim(), password);
        Alert.alert(
          'Check your email',
          'We sent you a confirmation link. Click it then come back to sign in.',
          [{ text: 'OK', onPress: () => setMode('login') }]
        );
      } else {
        await resetPassword(email.trim());
        Alert.alert(
          'Reset email sent',
          'Check your inbox for a password reset link.',
          [{ text: 'OK', onPress: () => setMode('login') }]
        );
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGuest = () => {
    continueAsGuest();
    router.replace('/(tabs)');
  };

  const getTitle = () => {
    if (mode === 'signup') return 'Create account';
    if (mode === 'forgot') return 'Reset password';
    return 'Welcome back';
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo */}
        <View style={styles.logo}>
          <Text style={styles.logoText}>W</Text>
        </View>
        <Text style={styles.appName}>Warpreader</Text>

        {/* Title */}
        <Text style={styles.title}>{getTitle()}</Text>

        {/* Form */}
        <View style={styles.form}>
          {error ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={16} color={Colors.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Email */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Email</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="mail-outline" size={18} color={Colors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor={Colors.textDisabled}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                returnKeyType={mode === 'forgot' ? 'done' : 'next'}
                onSubmitEditing={mode === 'forgot' ? handleSubmit : undefined}
              />
            </View>
          </View>

          {/* Password */}
          {mode !== 'forgot' && (
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Password</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="lock-closed-outline" size={18} color={Colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, styles.inputPassword]}
                  value={password}
                  onChangeText={setPassword}
                  placeholder={mode === 'signup' ? 'At least 6 characters' : '••••••••'}
                  placeholderTextColor={Colors.textDisabled}
                  secureTextEntry={!showPassword}
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  returnKeyType="done"
                  onSubmitEditing={handleSubmit}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeBtn}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={18}
                    color={Colors.textMuted}
                  />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Forgot password link */}
          {mode === 'login' && (
            <TouchableOpacity
              style={styles.forgotBtn}
              onPress={() => setMode('forgot')}
            >
              <Text style={styles.forgotText}>Forgot password?</Text>
            </TouchableOpacity>
          )}

          {/* Submit */}
          <TouchableOpacity
            style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={Colors.bg} />
            ) : (
              <Text style={styles.submitBtnText}>
                {mode === 'login' ? 'Sign In' : mode === 'signup' ? 'Create Account' : 'Send Reset Link'}
              </Text>
            )}
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Continue as guest */}
          <TouchableOpacity style={styles.guestBtn} onPress={handleGuest}>
            <Ionicons name="person-outline" size={18} color={Colors.textMuted} />
            <Text style={styles.guestBtnText}>Continue as guest</Text>
            <Text style={styles.guestLimit}>(3 docs/day)</Text>
          </TouchableOpacity>
        </View>

        {/* Switch mode */}
        <View style={styles.switchMode}>
          {mode === 'login' ? (
            <>
              <Text style={styles.switchText}>Don't have an account? </Text>
              <TouchableOpacity onPress={() => { setMode('signup'); setError(''); }}>
                <Text style={styles.switchLink}>Sign up</Text>
              </TouchableOpacity>
            </>
          ) : mode === 'signup' ? (
            <>
              <Text style={styles.switchText}>Already have an account? </Text>
              <TouchableOpacity onPress={() => { setMode('login'); setError(''); }}>
                <Text style={styles.switchLink}>Sign in</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity onPress={() => { setMode('login'); setError(''); }}>
              <Text style={styles.switchLink}>← Back to sign in</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  scroll: {
    flexGrow: 1,
    padding: Spacing.lg,
    paddingTop: 80,
    alignItems: 'center',
  },
  logo: {
    width: 72,
    height: 72,
    borderRadius: Radius.lg,
    backgroundColor: Colors.gold,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  logoText: {
    color: Colors.bg,
    fontSize: 36,
    fontWeight: Typography.bold,
  },
  appName: {
    color: Colors.textPrimary,
    fontSize: Typography.lg,
    fontWeight: Typography.semibold,
    marginBottom: Spacing.xl,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: Typography.xxl,
    fontWeight: Typography.bold,
    alignSelf: 'flex-start',
    marginBottom: Spacing.lg,
  },
  form: {
    width: '100%',
    gap: Spacing.md,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${Colors.error}20`,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: `${Colors.error}40`,
  },
  errorText: {
    color: Colors.error,
    fontSize: Typography.sm,
    flex: 1,
  },
  inputGroup: {
    gap: Spacing.xs,
  },
  inputLabel: {
    color: Colors.textMuted,
    fontSize: Typography.sm,
    fontWeight: Typography.medium,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
  },
  inputIcon: {
    marginRight: Spacing.sm,
  },
  input: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: Typography.md,
    paddingVertical: Spacing.md,
  },
  inputPassword: {
    paddingRight: 40,
  },
  eyeBtn: {
    padding: Spacing.sm,
  },
  forgotBtn: {
    alignSelf: 'flex-end',
  },
  forgotText: {
    color: Colors.gold,
    fontSize: Typography.sm,
  },
  submitBtn: {
    backgroundColor: Colors.gold,
    borderRadius: Radius.md,
    padding: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    color: Colors.bg,
    fontSize: Typography.md,
    fontWeight: Typography.bold,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  dividerText: {
    color: Colors.textMuted,
    fontSize: Typography.sm,
  },
  guestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  guestBtnText: {
    color: Colors.textPrimary,
    fontSize: Typography.md,
  },
  guestLimit: {
    color: Colors.textMuted,
    fontSize: Typography.sm,
  },
  switchMode: {
    flexDirection: 'row',
    marginTop: Spacing.xl,
    alignItems: 'center',
  },
  switchText: {
    color: Colors.textMuted,
    fontSize: Typography.sm,
  },
  switchLink: {
    color: Colors.gold,
    fontSize: Typography.sm,
    fontWeight: Typography.semibold,
  },
});
