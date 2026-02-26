
import * as admin from 'firebase-admin';

/**
 * Inicialización del SDK de Administración de Firebase.
 * Permite realizar operaciones de nivel de servidor como cambiar contraseñas de otros usuarios.
 */

if (!admin.apps.length) {
  try {
    admin.initializeApp({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      // En entornos de Google Cloud/Firebase, esto suele funcionar sin llaves explícitas.
      // Si corre localmente, requiere que la variable GOOGLE_APPLICATION_CREDENTIALS esté configurada.
    });
  } catch (error) {
    console.error('Error al inicializar Firebase Admin:', error);
  }
}

export const adminAuth = admin.auth();
export const adminDb = admin.firestore();
