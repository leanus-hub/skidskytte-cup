'use server';

import { createClient } from '@/lib/supabase/server';
import { parseExternalCsv } from '@/lib/external-results';
import { redirect } from 'next/navigation';

function text(fd:FormData,key:string){return String(fd.get(key)??'').trim();}
function normalize(value:string){return value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('sv-SE').replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();}

async function admin(){
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();
 if(!user) redirect('/admin/login');
 const {data:p}=await supabase.from('profiles').select('is_admin').eq('id',user.id).single();
 if(!p?.is_admin) redirect('/admin/login?error=not-admin');
 return {supabase,user};
}

export async function previewExternalResults(formData:FormData){
 const {supabase,user}=await admin();
 const file=formData.get('file');
 if(!(file instanceof File)||!file.size) redirect('/admin?section=external&error=missing-file');
 if(file.size>2_000_000) redirect('/admin?section=external&error=file-too-large');
 const sourceType=text(formData,'source_type')||'csv';
 const sourceName=text(formData,'source_name')||file.name;
 const eventName=text(formData,'event_name')||null;
 const eventDate=text(formData,'event_date')||null;
 let rows;
 try { rows=parseExternalCsv(await file.text()); }
 catch(error){redirect(`/admin?section=external&error=${encodeURIComponent(error instanceof Error?error.message:'Kunde inte läsa filen')}`);}

 const {data:athletes,error:ae}=await supabase.from('athletes').select('id,full_name,club_id,aliases,merged_into_id').is('merged_into_id',null);
 const {data:clubs,error:ce}=await supabase.from('clubs').select('id,name,short_name,aliases');
 if(ae||ce) redirect('/admin?section=external&error=match-data');

 const clubKeys=new Map<string,string|null>();
 for(const c of clubs??[]) for(const n of [c.name,c.short_name,...(c.aliases??[])]) if(n){
   const k=normalize(n); const current=clubKeys.get(k); clubKeys.set(k,current===undefined?c.id:current===c.id?c.id:null);
 }
 const athleteKeys=new Map<string,{id:string,club_id:string|null}|null>();
 const globalNames=new Map<string,{id:string,club_id:string|null}|null>();
 for(const a of athletes??[]) for(const n of [a.full_name,...(a.aliases??[])]) {
   const nk=normalize(n); const g=globalNames.get(nk); globalNames.set(nk,g===undefined?a:g?.id===a.id?a:null);
   if(a.club_id){const k=`${nk}|${a.club_id}`;const cur=athleteKeys.get(k);athleteKeys.set(k,cur===undefined?a:cur?.id===a.id?a:null);}
 }

 const planned=rows.map(r=>{
   const clubId=r.clubName?clubKeys.get(normalize(r.clubName)):undefined;
   const exact=clubId?athleteKeys.get(`${normalize(r.athleteName)}|${clubId}`):undefined;
   const global=globalNames.get(normalize(r.athleteName));
   if(exact) return {...r,matchedAthleteId:exact.id,matchStatus:'matched',matchNote:'Namn och klubb matchar.'};
   if(exact===null) return {...r,matchedAthleteId:null,matchStatus:'ambiguous',matchNote:'Flera åkare matchar namn och klubb.'};
   if(global) return {...r,matchedAthleteId:null,matchStatus:'ambiguous',matchNote:'Namnet finns på annan/okänd klubb. Granska manuellt.'};
   if(global===null) return {...r,matchedAthleteId:null,matchStatus:'ambiguous',matchNote:'Flera befintliga åkare har detta namn.'};
   return {...r,matchedAthleteId:null,matchStatus:'new',matchNote:'Ingen befintlig åkare matchar.'};
 });
 const needsReview=planned.some(r=>r.matchStatus==='ambiguous');

 const {data:batch,error:be}=await supabase.from('external_result_imports').insert({
   source_type:sourceType,source_name:sourceName,event_name:eventName,event_date:eventDate,
   status:needsReview?'needs_review':'preview',row_count:planned.length,created_by:user.id
 }).select('id').single();
 if(be||!batch) redirect(`/admin?section=external&error=${encodeURIComponent(be?.message??'Kunde inte skapa preview')}`);

 const payload=planned.map(r=>({
   import_id:batch.id,source_row:r.sourceRow,athlete_name:r.athleteName,club_name:r.clubName,class_name:r.className,
   place:r.place,status:r.status,shooting:r.shooting,shooting_hits:r.shootingHits,shooting_shots:r.shootingShots,
   matched_athlete_id:r.matchedAthleteId,match_status:r.matchStatus,match_note:r.matchNote,raw_data:r.raw
 }));
 const {error:re}=await supabase.from('external_result_rows').insert(payload);
 if(re) redirect(`/admin?section=external&error=${encodeURIComponent(re.message)}`);
 redirect(`/admin?section=external&batch=${batch.id}&success=preview-created`);
}

export async function approveExternalPreview(formData:FormData){
 const {supabase,user}=await admin(); const id=text(formData,'import_id');
 const {data:rows}=await supabase.from('external_result_rows').select('match_status').eq('import_id',id);
 if(!rows?.length) redirect('/admin?section=external&error=empty-preview');
 if(rows.some(r=>r.match_status==='ambiguous'||r.match_status==='unmatched')) redirect(`/admin?section=external&batch=${id}&error=review-required`);
 const {error}=await supabase.from('external_result_imports').update({status:'approved',approved_by:user.id,approved_at:new Date().toISOString()}).eq('id',id);
 if(error) redirect(`/admin?section=external&batch=${id}&error=${encodeURIComponent(error.message)}`);
 redirect(`/admin?section=external&batch=${id}&success=preview-approved`);
}


export async function resolveExternalAthlete(formData:FormData){
 const {supabase}=await admin();
 const rowId=text(formData,'row_id'), importId=text(formData,'import_id'), athleteId=text(formData,'athlete_id');
 if(!rowId||!importId||!athleteId) redirect('/admin?section=external&error=resolution-fields');
 const {data:athlete,error:ae}=await supabase.from('athletes').select('id,full_name').eq('id',athleteId).is('merged_into_id',null).single();
 if(ae||!athlete) redirect(`/admin?section=external&batch=${importId}&error=athlete-not-found`);
 const {error}=await supabase.from('external_result_rows').update({matched_athlete_id:athlete.id,match_status:'matched',match_note:`Manuellt kopplad till ${athlete.full_name}.`}).eq('id',rowId).eq('import_id',importId);
 if(error) redirect(`/admin?section=external&batch=${importId}&error=${encodeURIComponent(error.message)}`);
 const {data:remaining}=await supabase.from('external_result_rows').select('id').eq('import_id',importId).in('match_status',['ambiguous','unmatched']).limit(1);
 if(!remaining?.length) await supabase.from('external_result_imports').update({status:'preview'}).eq('id',importId).eq('status','needs_review');
 redirect(`/admin?section=external&batch=${importId}&success=athlete-resolved`);
}

export async function confirmExternalNewAthlete(formData:FormData){
 const {supabase}=await admin();
 const rowId=text(formData,'row_id'), importId=text(formData,'import_id');
 if(!rowId||!importId) redirect('/admin?section=external&error=resolution-fields');
 const {data:row,error:re}=await supabase.from('external_result_rows').select('athlete_name,match_status').eq('id',rowId).eq('import_id',importId).single();
 if(re||!row) redirect(`/admin?section=external&batch=${importId}&error=row-not-found`);
 if(!['new','ambiguous','unmatched'].includes(row.match_status)) redirect(`/admin?section=external&batch=${importId}&error=row-already-resolved`);
 const {error}=await supabase.from('external_result_rows').update({matched_athlete_id:null,match_status:'new',match_note:'Manuellt bekräftad som ny extern åkaridentitet. Ingen åkare skapas i cupregistret.'}).eq('id',rowId).eq('import_id',importId);
 if(error) redirect(`/admin?section=external&batch=${importId}&error=${encodeURIComponent(error.message)}`);
 const {data:remaining}=await supabase.from('external_result_rows').select('id').eq('import_id',importId).in('match_status',['ambiguous','unmatched']).limit(1);
 if(!remaining?.length) await supabase.from('external_result_imports').update({status:'preview'}).eq('id',importId).eq('status','needs_review');
 redirect(`/admin?section=external&batch=${importId}&success=athlete-resolved`);
}
