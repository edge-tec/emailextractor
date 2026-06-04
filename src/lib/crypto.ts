import CryptoJS from 'crypto-js';

const SECRET_KEY = process.env.NEXTAUTH_SECRET || 'fallback_secret_key_change_in_production';

export function encryptPassword(password: string): string {
  return CryptoJS.AES.encrypt(password, SECRET_KEY).toString();
}

export function decryptPassword(encryptedPassword: string): string {
  const bytes = CryptoJS.AES.decrypt(encryptedPassword, SECRET_KEY);
  return bytes.toString(CryptoJS.enc.Utf8);
}
