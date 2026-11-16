import { createBackendFetch, type BackendConfig } from './backend-transport';

// Keep the current service active until the new backend has passed its deployment checks.
export const backendConfig: BackendConfig = {
  provider: (import.meta.env ?? {}).VITE_BACKEND_PROVIDER ?? 'lovable',
  url: (import.meta.env ?? {}).VITE_MALHAENONG_SUPABASE_URL,
  key: (import.meta.env ?? {}).VITE_MALHAENONG_SUPABASE_PUBLISHABLE_KEY,
};

export const backendFetch = createBackendFetch(backendConfig);
