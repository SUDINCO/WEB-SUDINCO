
'use client';

import React, { createContext, useContext, useMemo, ReactNode } from 'react';
import { doc } from 'firebase/firestore';
import { useUser, useFirestore, useDoc } from '@/firebase';
import type { UserProfile, Role } from '@/lib/types';

interface UserProfileContextValue {
  userProfile: UserProfile | null;
  userRole: Role | null;
  isLoading: boolean;
}

const UserProfileContext = createContext<UserProfileContextValue | undefined>(undefined);

export function useUserProfile() {
  const context = useContext(UserProfileContext);
  if (!context) {
    throw new Error('useUserProfile must be used within a UserProfileProvider');
  }
  return context;
}

export function UserProfileProvider({ children }: { children: ReactNode }) {
  const { user, loading: userLoading } = useUser();
  const firestore = useFirestore();

  const userProfileDocRef = useMemo(() => {
    if (!firestore || !user?.uid) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user?.uid]);

  const { data: userProfile, isLoading: profileLoading } = useDoc<UserProfile>(userProfileDocRef);

  const roleDocRef = useMemo(() => {
    if (!firestore || !userProfile?.rol || typeof userProfile.rol !== 'string' || userProfile.rol.trim() === '') {
      return null;
    }
    // Assuming role name is the document ID in 'roles' collection
    return doc(firestore, 'roles', userProfile.rol);
  }, [firestore, userProfile?.rol]);

  const { data: userRole, isLoading: roleLoading } = useDoc<Role>(roleDocRef);

  // The loading state is a combination of auth, profile, and role loading.
  const isLoading = userLoading || profileLoading || roleLoading;

  const value = useMemo(() => ({
    userProfile,
    userRole,
    isLoading,
  }), [userProfile, userRole, isLoading]);

  return (
    <UserProfileContext.Provider value={value}>
      {children}
    </UserProfileContext.Provider>
  );
}
