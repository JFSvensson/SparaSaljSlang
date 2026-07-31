import path from 'path';

const rootDir = path.resolve(__dirname, '..');

export const config = {
  port: parseInt(process.env.PORT ?? '3000', 10),
  uploadsDir: path.join(rootDir, 'uploads'),
  loginUsername: process.env.LOGIN_USERNAME?.trim() || 'admin',
  loginPassword: process.env.LOGIN_PASSWORD?.trim() || 'change-me',
};
