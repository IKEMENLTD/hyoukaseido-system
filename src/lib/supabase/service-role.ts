// =============================================================================
// Supabase Service Role Client
// Cronジョブやバックグラウンドタスクで使用（cookies不要）
// =============================================================================

import { createClient } from '@supabase/supabase-js';

/**
 * Service Roleキーを使用するSupabaseクライアントを作成
 * cookiesに依存しないため、Cronジョブやバックグラウンド処理で使用可能
 */
export function createServiceRoleClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL が設定されていません');
  }
  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY が設定されていません');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
