/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_VERCEL_OBSERVABILITY_BASEPATH?: string;
  readonly VITE_VERCEL_OBSERVABILITY_CLIENT_CONFIG?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
