import { config } from './config';
import { randomBytes, scrypt, scryptSync, timingSafeEqual } from 'crypto';

const keyLength = 64;

export interface AuthenticationConfig {
  loginUsername: string;
  loginPassword: string;
  loginPasswordHash?: string;
  isProduction: boolean;
}

export function createPasswordHash(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, keyLength);
  return `scrypt$${salt.toString('base64url')}$${hash.toString('base64url')}`;
}

export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  const parsedHash = parsePasswordHash(passwordHash);
  if (!parsedHash) {
    return false;
  }

  const actualHash = await deriveKey(password, parsedHash.salt);
  return timingSafeEqual(actualHash, parsedHash.hash);
}

export async function authenticateUser(username?: string, password?: string): Promise<boolean> {
  return authenticateCredentials(username, password, config);
}

export async function authenticateCredentials(
  username: string | undefined,
  password: string | undefined,
  authenticationConfig: AuthenticationConfig
): Promise<boolean> {
  if (username !== authenticationConfig.loginUsername || !password) {
    return false;
  }

  if (authenticationConfig.loginPasswordHash) {
    return verifyPassword(password, authenticationConfig.loginPasswordHash);
  }

  return !authenticationConfig.isProduction && password === authenticationConfig.loginPassword;
}

function deriveKey(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keyLength, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(derivedKey as Buffer);
    });
  });
}

function parsePasswordHash(passwordHash: string): { salt: Buffer; hash: Buffer } | null {
  const [algorithm, saltValue, hashValue] = passwordHash.split('$');
  if (algorithm !== 'scrypt' || !saltValue || !hashValue) {
    return null;
  }

  const salt = Buffer.from(saltValue, 'base64url');
  const hash = Buffer.from(hashValue, 'base64url');
  if (salt.length === 0 || hash.length !== keyLength) {
    return null;
  }

  return { salt, hash };
}
