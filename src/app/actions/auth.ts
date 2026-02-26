
'use server';

import { adminAuth } from '@/lib/firebase-admin';

/**
 * Acción de servidor para resetear la contraseña de un trabajador.
 * Establece la contraseña directamente al número de cédula en Firebase Auth.
 * 
 * @param uid UID del usuario en Firebase Auth.
 * @param cedula El número de cédula que servirá como contraseña temporal.
 */
export async function resetUserPasswordAction(uid: string, cedula: string) {
  try {
    if (!uid || !cedula) {
      throw new Error('UID y Cédula son obligatorios para el reseteo.');
    }

    await adminAuth.updateUser(uid, {
      password: cedula,
    });

    return { success: true };
  } catch (error: any) {
    console.error('Error en resetUserPasswordAction:', error);
    return { 
      success: false, 
      error: error.message || 'Error desconocido al actualizar la contraseña en el servidor.' 
    };
  }
}
