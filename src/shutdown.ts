export interface ClosableServer {
  close(callback: (error?: Error) => void): unknown;
}

export function closeResources(
  server: ClosableServer,
  closeDatabase: () => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((serverError) => {
      if (serverError) {
        reject(serverError);
        return;
      }

      try {
        closeDatabase();
        resolve();
      } catch (databaseError) {
        reject(databaseError);
      }
    });
  });
}
