declare module "vitest" {
  interface ProvidedContext {
    /** Connection string for the throwaway Postgres started in `globalSetup`. */
    databaseUrl: string;
  }
}

export {};
