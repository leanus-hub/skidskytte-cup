'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim();
}

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/admin/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single();

  if (!profile?.is_admin) redirect('/admin/login?error=not-admin');
  return supabase;
}

export async function login(formData: FormData) {
  const supabase = await createClient();
  const email = text(formData, 'email');
  const password = text(formData, 'password');
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect('/admin/login?error=login');
  redirect('/admin');
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/admin/login');
}

export async function createCup(formData: FormData) {
  const supabase = await requireAdmin();
  const seasonId = text(formData, 'season_id');
  const name = text(formData, 'name');
  const cupType = text(formData, 'cup_type');

  if (!seasonId || !name || !['sommar', 'vinter'].includes(cupType)) {
    redirect('/admin?error=cup-fields');
  }

  const { error } = await supabase.from('cups').insert({
    season_id: seasonId,
    name,
    cup_type: cupType,
    min_races_for_prize: 3,
    active: true,
  });

  if (error) redirect(`/admin?error=${encodeURIComponent(error.message)}`);
  revalidatePath('/admin');
  redirect('/admin?success=cup-created');
}

export async function createRace(formData: FormData) {
  const supabase = await requireAdmin();
  const cupId = text(formData, 'cup_id');
  const name = text(formData, 'name');
  const raceDate = text(formData, 'race_date') || null;
  const sourceUrl = text(formData, 'source_url');
  let raceId = '';

  try {
    const parsed = new URL(sourceUrl);
    raceId = parsed.searchParams.get('raceId')?.trim() ?? '';
    if (parsed.hostname !== 'results.biathlontiming.se' || !raceId) throw new Error();
  } catch {
    redirect('/admin?error=invalid-race-url');
  }

  if (!cupId || !name) redirect('/admin?error=race-fields');

  const { data: lastRace } = await supabase
    .from('races')
    .select('sort_order')
    .eq('cup_id', cupId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from('races').insert({
    cup_id: cupId,
    external_race_id: raceId,
    source_url: sourceUrl,
    name,
    race_date: raceDate,
    sort_order: (lastRace?.sort_order ?? 0) + 1,
    status: 'draft',
  });

  if (error) redirect(`/admin?error=${encodeURIComponent(error.message)}`);
  revalidatePath('/admin');
  redirect('/admin?success=race-created');
}
