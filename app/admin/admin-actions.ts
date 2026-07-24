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


export async function createSeason(formData: FormData) {
  const supabase = await requireAdmin();
  const name = text(formData, 'name');
  const startsOn = text(formData, 'starts_on');
  const endsOn = text(formData, 'ends_on');
  const isActive = text(formData, 'is_active') === 'true';
  if (!name || !startsOn || !endsOn) redirect('/admin?section=season&error=season-fields');
  const { error } = await supabase.from('seasons').insert({ name, starts_on: startsOn, ends_on: endsOn, is_active: isActive });
  if (error) redirect(`/admin?section=season&error=${encodeURIComponent(error.message)}`);
  revalidatePath('/admin');
  redirect('/admin?section=season&success=season-created');
}

export async function createCup(formData: FormData) {
  const supabase = await requireAdmin();
  const seasonId = text(formData, 'season_id');
  const name = text(formData, 'name');
  const cupType = text(formData, 'cup_type');
  const regionId = text(formData, 'region_id');

  if (!seasonId || !name || !['sommar', 'vinter'].includes(cupType) || !regionId) {
    redirect('/admin?section=cup&error=cup-fields');
  }

  const { error } = await supabase.from('cups').insert({
    season_id: seasonId,
    name,
    cup_type: cupType,
    competition_scope: 'region',
    region_id: regionId,
    min_races_for_prize: 3,
    active: true,
  });

  if (error) redirect(`/admin?section=cup&error=${encodeURIComponent(error.message)}`);
  revalidatePath('/admin');
  redirect('/admin?section=cup&success=cup-created');
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
    redirect('/admin?section=race&error=invalid-race-url');
  }

  if (!cupId || !name) redirect('/admin?section=race&error=race-fields');

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

  if (error) redirect(`/admin?section=race&error=${encodeURIComponent(error.message)}`);
  revalidatePath('/admin');
  redirect('/admin?section=race&success=race-created');
}

export async function setRaceStatus(formData: FormData) {
  const supabase = await requireAdmin();
  const raceId = text(formData, 'race_id');
  const status = text(formData, 'status');

  if (!raceId || !['draft', 'published'].includes(status)) {
    redirect('/admin?error=invalid-race-status');
  }

  const { error } = await supabase.from('races').update({ status }).eq('id', raceId);
  if (error) redirect(`/admin?error=${encodeURIComponent(error.message)}`);

  revalidatePath('/');
  revalidatePath('/admin');
  redirect(`/admin?section=import&success=${status === 'published' ? 'race-published' : 'race-unpublished'}`);
}

function normalizeName(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('sv-SE')
    .replace(/&/g, ' och ')
    .replace(/\b(idrottsforening|skidklubb|skid och orienteringsklubb|skid o orienteringsklubb)\b/g, match => match)
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function canonicalClassName(value: string) {
  return value
    .replace(/(\d)\s*[.–—]\s*(\d)/g, '$1-$2')
    .replace(/\s+(massstart|sprint|distans|kortdistans|individuell|jaktstart|stafett|supersprint)(\s+.*)?$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeClassName(value: string) {
  return normalizeName(canonicalClassName(value)).replace(/\s+/g, '');
}

export async function addClassAlias(formData: FormData) {
  const supabase = await requireAdmin();
  const classId = text(formData, 'class_id');
  const alias = text(formData, 'alias');
  if (!classId || !alias) redirect('/admin?section=classes&error=class-alias-fields');

  const { data: classRow, error: readError } = await supabase
    .from('classes')
    .select('id,name,aliases')
    .eq('id', classId)
    .single();
  if (readError || !classRow) redirect('/admin?section=classes&error=class-not-found');

  const aliases = Array.from(new Set([...(classRow.aliases ?? []), alias]))
    .filter(value => normalizeClassName(value) !== normalizeClassName(classRow.name));
  const { error } = await supabase.from('classes').update({ aliases }).eq('id', classId);
  if (error) redirect(`/admin?error=${encodeURIComponent(error.message)}`);

  revalidatePath('/admin');
  redirect('/admin?section=classes&success=class-alias-added');
}

export async function updateClubRegion(formData: FormData) {
  const supabase = await requireAdmin();
  const clubId = text(formData, 'club_id');
  const regionId = text(formData, 'region_id');
  if (!clubId || !regionId) redirect('/admin?section=clubs&error=club-region-fields');
  const { error } = await supabase.from('clubs').update({ region_id: regionId }).eq('id', clubId);
  if (error) redirect(`/admin?section=clubs&error=${encodeURIComponent(error.message)}`);
  const returnRegion = text(formData, 'return_region');
  revalidatePath('/');
  revalidatePath('/admin');
  redirect(`/admin?section=clubs&region=${encodeURIComponent(returnRegion)}&club=${encodeURIComponent(clubId)}&success=club-region-updated`);
}

export async function addClubAlias(formData: FormData) {
  const supabase = await requireAdmin();
  const clubId = text(formData, 'club_id');
  const alias = text(formData, 'alias');
  if (!clubId || !alias) redirect('/admin?section=clubs&error=club-alias-fields');
  const { data: club, error: readError } = await supabase.from('clubs').select('id,name,aliases').eq('id', clubId).single();
  if (readError || !club) redirect('/admin?section=clubs&error=club-not-found');
  const aliases = Array.from(new Set([...(club.aliases ?? []), alias])).filter(value => normalizeName(value) !== normalizeName(club.name));
  const { error } = await supabase.from('clubs').update({ aliases }).eq('id', clubId);
  if (error) redirect(`/admin?section=clubs&error=${encodeURIComponent(error.message)}`);
  const returnRegion = text(formData, 'return_region');
  revalidatePath('/admin');
  redirect(`/admin?section=clubs&region=${encodeURIComponent(returnRegion)}&club=${encodeURIComponent(clubId)}&success=club-alias-added`);
}

export async function importRaceResults(formData: FormData) {
  const supabase = await requireAdmin();
  const databaseRaceId = text(formData, 'race_id');
  if (!databaseRaceId) redirect('/admin?section=import&error=missing-race-id');

  const { data: race, error: raceError } = await supabase
    .from('races')
    .select('id,cup_id,external_race_id,source_url')
    .eq('id', databaseRaceId)
    .single();
  if (raceError || !race) redirect('/admin?section=import&error=race-not-found');

  const { importBiathlonTiming } = await import('@/lib/biathlontiming');

  await supabase.from('races').update({ import_status: 'processing', import_error: null }).eq('id', race.id);

  let importedCountForRedirect = 0;
  let outsideCountForRedirect = 0;
  try {
    const imported = await importBiathlonTiming(race.external_race_id, race.source_url);
    const { data: clubs } = await supabase.from('clubs').select('id,name,short_name,aliases,region_id,active');
    type ClubRow = { id: string; name: string; short_name: string | null; aliases: string[] | null; region_id: string | null; active: boolean };
    const clubMap = new Map<string, ClubRow>();
    for (const club of clubs ?? []) {
      for (const alias of [club.name, club.short_name, ...(club.aliases ?? [])]) {
        if (alias) clubMap.set(normalizeName(alias), club);
      }
    }

    type ClassRow = { id: string; name: string; aliases: string[] | null };
    const { data: existingClasses, error: classesError } = await supabase
      .from('classes')
      .select('id,name,aliases')
      .eq('is_official', true);
    if (classesError) throw classesError;

    const classMap = new Map<string, ClassRow>();
    for (const classRow of existingClasses ?? []) {
      for (const alias of [classRow.name, ...(classRow.aliases ?? [])]) {
        if (alias) classMap.set(normalizeClassName(alias), classRow);
      }
    }

    const classCache = new Map<string, string>();
    const athleteCache = new Map<string, string>();
    let importedCount = 0;
    let outsideClubCount = 0;

    for (const row of imported.results) {
      const classKey = normalizeClassName(row.className);
      let classId = classCache.get(classKey);
      if (!classId) {
        const matchedClass = classMap.get(classKey);
        if (!matchedClass) {
          throw new Error(
            `Okänd klass: ${row.className}. Lägg till namnet som alias under Klassalias och importera igen.`
          );
        }

        classId = matchedClass.id;
        for (const alias of [matchedClass.name, ...(matchedClass.aliases ?? [])]) {
          classMap.set(normalizeClassName(alias), matchedClass);
          classCache.set(normalizeClassName(alias), matchedClass.id);
        }
      }
      if (!classId) throw new Error(`Klassen ${row.className} saknar id.`);

      const clubKey = normalizeName(row.clubName);
      let club = clubMap.get(clubKey);
      if (!club) {
        const { data: createdClub, error } = await supabase
          .from('clubs')
          .insert({ name: row.clubName, short_name: row.clubName, aliases: [row.clubName], active: true, region_id: null })
          .select('id,name,short_name,aliases,region_id,active')
          .single();
        if (error?.code === '23505') {
          const { data: existing } = await supabase.from('clubs').select('id,name,short_name,aliases,region_id,active').eq('name', row.clubName).single();
          club = existing ?? undefined;
        } else if (error) throw error;
        else club = createdClub;
        if (club) clubMap.set(clubKey, club);
      }
      if (!club) throw new Error(`Klubben ${row.clubName} kunde inte sparas.`);
      if (!club.region_id) outsideClubCount += 1;

      const athleteKey = `${normalizeName(row.athleteName)}|${club.id}`;
      let athleteId = athleteCache.get(athleteKey);
      if (!athleteId) {
        const { data: existingAthletes } = await supabase
          .from('athletes').select('id').eq('club_id', club.id).ilike('full_name', row.athleteName).limit(1);
        if (existingAthletes?.[0]) athleteId = existingAthletes[0].id;
        else {
          const { data: createdAthlete, error } = await supabase
            .from('athletes').insert({ full_name: row.athleteName, club_id: club.id }).select('id').single();
          if (error) throw error;
          athleteId = createdAthlete.id;
        }
        if (!athleteId) throw new Error(`Åkaren ${row.athleteName} kunde inte sparas.`);
        athleteCache.set(athleteKey, athleteId);
      }
      if (!athleteId) throw new Error(`Åkaren ${row.athleteName} saknar id.`);

      const { error: resultError } = await supabase.from('results').upsert({
        race_id: race.id,
        class_id: classId,
        athlete_id: athleteId,
        bib: row.bib,
        place: row.place,
        status: row.status,
        total_time_ms: row.totalTimeMs,
        shooting: row.shooting,
        shooting_hits: row.shootingHits,
        shooting_shots: row.shootingShots,
        raw_data: row.raw,
      }, { onConflict: 'race_id,class_id,athlete_id' });
      if (resultError) throw resultError;
      importedCount += 1;
    }

    await supabase.from('races').update({
      import_status: 'imported',
      import_error: null,
      imported_at: new Date().toISOString(),
      imported_result_count: importedCount,
      import_source_used: imported.sourceUsed,
      import_warnings: imported.warnings,
    }).eq('id', race.id);

    importedCountForRedirect = importedCount;
    outsideCountForRedirect = outsideClubCount;
    revalidatePath('/');
    revalidatePath('/admin');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Okänt importfel';
    await supabase.from('races').update({ import_status: 'failed', import_error: message }).eq('id', race.id);
    revalidatePath('/admin');
    redirect(`/admin?error=${encodeURIComponent(message)}`);
  }

  redirect(`/admin?section=import&success=results-imported&count=${importedCountForRedirect}&outside=${outsideCountForRedirect}`);
}
