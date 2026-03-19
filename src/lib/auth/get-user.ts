import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';

/**
 * React.cache()でリクエスト単位にメモ化されたgetUser。
 * layout.tsxとpage.tsxの両方から呼んでも、Supabaseへの問い合わせは1回だけ。
 */
export const getUser = cache(async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
});
