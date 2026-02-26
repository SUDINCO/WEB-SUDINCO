'use server';

import { adminAuth, adminDb } from '@/lib/firebase-admin';

/**
 * Acción de servidor para resetear la contraseña de un trabajador.
 * Utiliza el Admin SDK para actualizar la contraseña en Firebase Auth y
 * marca el documento en Firestore para forzar el cambio de clave.
 * 
 * @param uid UID del usuario en Firebase Auth.
 * @param cedula El número de cédula que servirá como contraseña temporal.
 */
export async function resetUserPasswordAction(uid: string, cedula: string) {
  try {
    if (!uid || !cedula) {
      throw new Error('UID y Cédula son obligatorios para el reseteo.');
    }

    if (!adminAuth || !adminDb) {
        throw new Error('El SDK de Administración no está disponible en el servidor.');
    }

    // 1. Actualizamos la contraseña directamente en Firebase Auth
    await adminAuth.updateUser(uid, {
      password: cedula,
    });

    // 2. Marcamos el perfil en Firestore para que el sistema le obligue a cambiar la clave al entrar
    await adminDb.collection('users').doc(uid).update({
        requiresPasswordChange: true,
    });

    return { success: true };
  } catch (error: any) {
    console.error('Error en resetUserPasswordAction:', error);
    
    let errorMessage = error.message || 'Error desconocido en el servidor.';
    if (errorMessage.includes('credential')) {
        errorMessage = 'Error de Permisos: El servidor no está autorizado para administrar usuarios.';
    }

    return { 
      success: false, 
      error: errorMessage 
    };
  }
}
