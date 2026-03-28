import { useState, useEffect, useCallback } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export type AuthState = {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  isGuest: boolean;
  isPro: boolean;
};

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    session: null,
    user: null,
    isLoading: true,
    isGuest: false,
    isPro: false,
  });

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setState((s) => ({
        ...s,
        session,
        user: session?.user ?? null,
        isLoading: false,
        isGuest: !session,
      }));
      if (session?.user) {
        checkProStatus(session.user.id);
      }
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setState((s) => ({
        ...s,
        session,
        user: session?.user ?? null,
        isLoading: false,
        isGuest: !session,
      }));
      if (session?.user) {
        checkProStatus(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkProStatus = async (userId: string) => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('plan')
        .eq('id', userId)
        .single();
      setState((s) => ({ ...s, isPro: data?.plan === 'pro' }));
    } catch {
      // Ignore — default to free
    }
  };

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'warpreader://reset-password',
    });
    if (error) throw error;
  }, []);

  const continueAsGuest = useCallback(() => {
    setState((s) => ({ ...s, isGuest: true, isLoading: false }));
  }, []);

  return {
    ...state,
    signIn,
    signUp,
    signOut,
    resetPassword,
    continueAsGuest,
  };
}
