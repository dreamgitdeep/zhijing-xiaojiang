import { getSupabaseClient } from '@/storage/database/supabase-client';

export function getAdminClient() {
  return getSupabaseClient();
}

export function getUserClient(accessToken: string) {
  return getSupabaseClient(accessToken);
}

export function isCloudConfigured(): boolean {
  try {
    getSupabaseClient();
    return true;
  } catch {
    return false;
  }
}
