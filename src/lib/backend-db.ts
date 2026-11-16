import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
import { supabase as legacySupabase } from '@/integrations/supabase/client';
import { backendConfig } from './backend-fetch';

let client: SupabaseClient<Database> | undefined;
function getClient() {
  if (backendConfig.provider !== 'supabase') return legacySupabase;
  if (!backendConfig.url || !backendConfig.key) throw new Error('Supabase 연결 설정이 필요합니다.');
  return client ??= createClient<Database>(backendConfig.url, backendConfig.key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
export const supabase = new Proxy({} as SupabaseClient<Database>, {
  get(_target, property) { const target = getClient(); const value = Reflect.get(target, property); return typeof value === 'function' ? value.bind(target) : value; },
});
