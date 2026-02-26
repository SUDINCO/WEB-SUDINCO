'use server';

import { adminAuth, adminDb } from '@/lib/firebase-admin';

/**
 * Acción de servidor para crear un nuevo usuario.
 */
export async function createUserAction(userData: any) {
  try {
    if (!adminAuth || !adminDb) {
      throw new Error('El SDK de Administración no está disponible en el servidor.');
    }

    // 1. Crear el usuario en Firebase Auth
    const userRecord = await adminAuth.createUser({
      email: userData.email,
      password: userData.cedula, // Contraseña inicial: Cédula
      displayName: `${userData.nombres} ${userData.apellidos}`,
    });

    // 2. Guardar el perfil en Firestore con la marca de cambio de clave obligatorio
    const { email, ...rest } = userData;
    await adminDb.collection('users').doc(userRecord.uid).set({
      ...rest,
      email: email.toLowerCase().trim(),
      requiresPasswordChange: true,
      id: userRecord.uid,
    });

    return { success: true, uid: userRecord.uid };
  } catch (error: any) {
    console.error('Error en createUserAction:', error);
    return { 
      success: false, 
      error: error.message || 'Error al crear el usuario en el servidor.' 
    };
  }
}

/**
 * Acción de servidor para resetear la contraseña de un trabajador.
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
    return { 
      success: false, 
      error: error.message || 'Error desconocido en el servidor.' 
    };
  }
}
