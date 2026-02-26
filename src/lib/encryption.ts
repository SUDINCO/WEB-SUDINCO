'use client';

import CryptoJS from 'crypto-js';

/**
 * Módulo de Criptografía para el sistema PERFORMA.
 * Utiliza AES-256 para asegurar que los datos sensibles (como cédulas o notas personales)
 * se almacenen cifrados en la base de datos.
 */

const SECRET_KEY = process.env.NEXT_PUBLIC_ENCRYPTION_KEY || 'default-performa-key-secure-2024';

/**
 * Encrita una cadena de texto usando AES.
 * @param data Texto plano a cifrar.
 * @returns Cadena cifrada en formato Base64.
 */
export const encryptData = (data: string): string => {
  try {
    return CryptoJS.AES.encrypt(data, SECRET_KEY).toString();
  } catch (error) {
    console.error('Error durante el cifrado de datos:', error);
    return data; // Fallback al original en caso de error (no recomendado para producción real)
  }
};

/**
 * Descifra una cadena cifrada con AES.
 * @param ciphertext Texto cifrado en Base64.
 * @returns Texto plano original.
 */
export const decryptData = (ciphertext: string): string => {
  try {
    const bytes = CryptoJS.AES.decrypt(ciphertext, SECRET_KEY);
    const originalText = bytes.toString(CryptoJS.enc.Utf8);
    return originalText || ciphertext;
  } catch (error) {
    console.error('Error durante el descifrado de datos:', error);
    return ciphertext;
  }
};

/**
 * Cifra campos específicos de un objeto de manera recursiva.
 * @param obj Objeto con datos.
 * @param fields Lista de claves a cifrar.
 */
export const encryptObjectFields = (obj: any, fields: string[]): any => {
  const newObj = { ...obj };
  fields.forEach(field => {
    if (newObj[field] && typeof newObj[field] === 'string') {
      newObj[field] = encryptData(newObj[field]);
    }
  });
  return newObj;
};
