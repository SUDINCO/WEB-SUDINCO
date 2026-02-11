'use client';

import { Auth, onAuthStateChanged, User } from 'firebase/auth';
import { useEffect, useMemo, useState } from 'react';
import { useFirebase } from '../provider';

/**
 * Hook to access the Firebase Auth service instance.
 */
export function useAuth(): Auth {
  const { auth } = useFirebase();
  if (!auth) {
    throw new Error('Auth service not available. Check FirebaseProvider setup.');
  }
  return auth;
}

/**
 * Hook for accessing the current authenticated user's state.
 * This is the single source of truth for the user's auth status.
 */
export function useUser() {
  const auth = useAuth();
  const [user, setUser] = useState<User | null>(() => auth.currentUser);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [auth]);

  return useMemo(
    () => ({
      user,
      loading,
    }),
    [user, loading]
  );
}
