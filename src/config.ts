import path from 'path';

const rootDir = path.resolve(__dirname, '..');
const isProduction = process.env.NODE_ENV === 'production';

export const config = {
  port: parseInt(process.env.PORT ?? '3000', 10),
  uploadsDir: path.join(rootDir, 'uploads'),
  loginUsername: process.env.LOGIN_USERNAME?.trim() || 'admin',
  loginPassword: process.env.LOGIN_PASSWORD?.trim() || 'change-me',
  isProduction,
  sessionSecret: process.env.SESSION_SECRET?.trim() || 'development-session-secret',
  sessionMaxAgeMs: 8 * 60 * 60 * 1000,
};

export function validateConfig(): void {
  if (!config.isProduction) {
    return;
  }

  const requiredVariables = ['LOGIN_USERNAME', 'LOGIN_PASSWORD', 'SESSION_SECRET'];
  const missing = requiredVariables.filter((variable) => !process.env[variable]?.trim());
  if (missing.length > 0) {
    throw new Error(`Missing required production configuration: ${missing.join(', ')}`);
  }
}
