import 'express-session';

declare module 'express-session' {
  interface SessionData {
    isAuthenticated?: boolean;
    isAdministrator?: boolean;
    voterId?: string;
  }
}
