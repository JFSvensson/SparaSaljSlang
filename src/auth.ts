import { config } from './config';

export function authenticateUser(username?: string, password?: string): boolean {
  return username === config.loginUsername && password === config.loginPassword;
}
