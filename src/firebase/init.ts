'use client';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getMessaging, Messaging, isSupported } from 'firebase/messaging';

type FirebaseServices = {
  firebaseApp: FirebaseApp;
  auth: Auth;
  firestore: Firestore;
  messaging?: Messaging;
};

export function initializeFirebase(): FirebaseServices {
  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  
  const auth = getAuth(app);
  const firestore = getFirestore(app);

  const services: FirebaseServices = {
    firebaseApp: app,
    auth: auth,
    firestore: firestore
  };

  // Solo inicializar messaging en el cliente y si es soportado
  if (typeof window !== 'undefined') {
    isSupported().then(supported => {
      if (supported) {
        services.messaging = getMessaging(app);
      }
    });
  }
  
  return services;
}

export function getSdks(firebaseApp: FirebaseApp) {
  return {
    firebaseApp,
    auth: getAuth(firebaseApp),
    firestore: getFirestore(firebaseApp)
  };
}
