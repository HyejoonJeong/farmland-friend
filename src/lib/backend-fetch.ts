import { createBackendFetch, type BackendConfig } from './backend-transport';

// All production API calls now use the verified user-owned Supabase project.
export const backendConfig: BackendConfig = {
  provider: 'supabase',
  url: (import.meta.env ?? {}).VITE_MALHAENONG_SUPABASE_URL,
  key: (import.meta.env ?? {}).VITE_MALHAENONG_SUPABASE_PUBLISHABLE_KEY,
};

export const backendFetch = createBackendFetch(backendConfig);
