'use client';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';

type FirebaseServices = {
  firebaseApp: FirebaseApp;
  auth: Auth;
  firestore: Firestore;
};

// NOTE: We are intentionally not caching the services object in a module-level variable.
// This is to ensure that on every HMR (Hot Module Replacement) during development,
// the initializeFirebase function is re-executed.

export function initializeFirebase(): FirebaseServices {
  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  
  const auth = getAuth(app);
  const firestore = getFirestore(app);

  const services: FirebaseServices = {
    firebaseApp: app,
    auth: auth,
    firestore: firestore
  };
  
  return services;
}

export function getSdks(firebaseApp: FirebaseApp) {
  return {
    firebaseApp,
    auth: getAuth(firebaseApp),
    firestore: getFirestore(firebaseApp)
  };
}
