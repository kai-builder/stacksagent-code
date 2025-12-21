import { scryptSync, randomBytes, createCipheriv, createDecipheriv, createHash } from 'crypto';
import { EncryptedKeystore } from '../types/index.js';
import { SCRYPT_PARAMS } from './constants.js';

/**
 * Encrypts a private key using scrypt + AES-256-GCM
 */
export function encryptPrivateKey(
  privateKey: string,
  password: string
): EncryptedKeystore {
  // Generate random salt and IV
  const salt = randomBytes(32);
  const iv = randomBytes(16);

  // Derive key using scrypt with proper parameters
  const derivedKey = scryptSync(password, salt, SCRYPT_PARAMS.dklen, {
    cost: SCRYPT_PARAMS.N,
    blockSize: SCRYPT_PARAMS.r,
    parallelization: SCRYPT_PARAMS.p,
  });

  // Encrypt the private key
  const cipher = createCipheriv('aes-256-gcm', derivedKey, iv);
  const ciphertext = Buffer.concat([cipher.update(privateKey, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Combine ciphertext and auth tag
  const combined = Buffer.concat([ciphertext, authTag]);

  // Generate MAC for integrity check
  const mac = createHash('sha256')
    .update(Buffer.concat([derivedKey.slice(16, 32), combined]))
    .digest('hex');

  // Create keystore object
  const keystore: EncryptedKeystore = {
    version: 1,
    crypto: {
      cipher: 'aes-256-gcm',
      ciphertext: combined.toString('hex'),
      cipherparams: {
        iv: iv.toString('hex'),
      },
      kdf: 'scrypt',
      kdfparams: {
        salt: salt.toString('hex'),
        n: SCRYPT_PARAMS.N,
        r: SCRYPT_PARAMS.r,
        p: SCRYPT_PARAMS.p,
        dklen: SCRYPT_PARAMS.dklen,
      },
      mac,
    },
    address: '', // Will be set by wallet service
  };

  return keystore;
}

/**
 * Decrypts an encrypted keystore using password
 */
export function decryptPrivateKey(
  keystore: EncryptedKeystore,
  password: string
): string {
  const { crypto } = keystore;

  // Derive key using scrypt with proper parameters
  const salt = Buffer.from(crypto.kdfparams.salt, 'hex');
  const derivedKey = scryptSync(password, salt, crypto.kdfparams.dklen, {
    cost: crypto.kdfparams.n,
    blockSize: crypto.kdfparams.r,
    parallelization: crypto.kdfparams.p,
  });

  // Verify MAC
  const combined = Buffer.from(crypto.ciphertext, 'hex');
  const mac = createHash('sha256')
    .update(Buffer.concat([derivedKey.slice(16, 32), combined]))
    .digest('hex');

  if (mac !== crypto.mac) {
    throw new Error('Invalid password or corrupted keystore');
  }

  // Decrypt
  const iv = Buffer.from(crypto.cipherparams.iv, 'hex');
  const authTagLength = 16;
  const ciphertext = combined.slice(0, -authTagLength);
  const authTag = combined.slice(-authTagLength);

  const decipher = createDecipheriv('aes-256-gcm', derivedKey, iv);
  decipher.setAuthTag(authTag);

  const privateKey = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString(
    'utf8'
  );

  return privateKey;
}

/**
 * Generates a random password for testing purposes
 * WARNING: In production, users should provide strong passwords
 */
export function generateRandomPassword(length: number = 32): string {
  return randomBytes(length).toString('hex');
}
