declare module "vitest" {
  interface ProvidedContext {
    /** Connection string for the throwaway Postgres started in `globalSetup`. */
    databaseUrl: string;
    /** The one build the server tests share, made in `globalSetup`. */
    buildDir: string;
  }
}

export {};
