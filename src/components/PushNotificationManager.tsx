'use client';

import { useEffect } from 'react';
import { useFirebase, useUser } from '@/firebase';
import { getToken, onMessage } from 'firebase/messaging';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';

export function PushNotificationManager() {
  const { messaging, firestore } = useFirebase();
  const { user } = useUser();

  useEffect(() => {
    if (!messaging || !user || !firestore) return;

    const requestPermission = async () => {
      try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          // Obtener el token de FCM
          // El vapidKey es necesario. Si no tienes uno, se puede generar en la consola de Firebase (Project Settings -> Cloud Messaging)
          const token = await getToken(messaging, {
            vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY
          });

          if (token) {
            // Guardar el token en el perfil del usuario en Firestore
            const userRef = doc(firestore, 'users', user.uid);
            await updateDoc(userRef, {
              fcmTokens: arrayUnion(token)
            });
            console.log('Token de notificaciones guardado.');
          }
        }
      } catch (error) {
        console.error('Error al configurar notificaciones push:', error);
      }
    };

    requestPermission();

    // Escuchar mensajes mientras la app está en primer plano
    const unsubscribe = onMessage(messaging, (payload) => {
      console.log('Mensaje recibido en primer plano:', payload);
      toast({
        title: payload.notification?.title || 'Nueva Notificación',
        description: payload.notification?.body || '',
      });
    });

    return () => unsubscribe();
  }, [messaging, user, firestore]);

  return null;
}
