
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

    if (!adminAuth) {
        throw new Error('El SDK de Administración no está disponible en el servidor.');
    }

    // Actualizamos la contraseña en el sistema de Autenticación de Firebase
    await adminAuth.updateUser(uid, {
      password: cedula,
    });

    return { success: true };
  } catch (error: any) {
    console.error('Error en resetUserPasswordAction:', error);
    
    // Tratamos de dar un mensaje más útil según el error técnico
    let errorMessage = error.message || 'Error desconocido en el servidor.';
    if (errorMessage.includes('credential')) {
        errorMessage = 'Error de Permisos: El servidor no está autorizado para cambiar contraseñas. Verifique la configuración de Firebase Admin.';
    }

    return { 
      success: false, 
      error: errorMessage 
    };
  }
}
