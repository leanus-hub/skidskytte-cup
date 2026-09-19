'use client';
import { useState } from 'react';
import { createPlannedRaces } from './admin-actions';

type Club={id:string;name:string};
type Row={name:string;race_date:string;location:string;organizer_club_id:string};
const blank=():Row=>({name:'',race_date:'',location:'',organizer_club_id:''});

export default function CupPlanBuilder({cupId,clubs,existingCount=0}:{cupId:string;clubs:Club[];existingCount?:number}){
 const [rows,setRows]=useState<Row[]>(existingCount===0?Array.from({length:6},blank):[blank()]);
 const update=(i:number,key:keyof Row,value:string)=>setRows(current=>current.map((r,n)=>n===i?{...r,[key]:value}:r));
 const active=rows.filter(r=>r.name.trim()).length;
 return <form action={createPlannedRaces} className="cup-plan-builder">
  <input type="hidden" name="cup_id" value={cupId}/><input type="hidden" name="races_json" value={JSON.stringify(rows)}/>
  <div className="plan-toolbar"><div><strong>{existingCount?'Lägg till deltävling':'Planera hela cupen'}</strong><p className="muted">{existingCount?`Cupen har redan ${existingCount} deltävlingar. Lägg bara till nästa tävling här.`:'Fyll i de deltävlingar ni känner till. BiathlonTiming kopplas först när resultat finns.'}</p></div><span className="badge">{active} nya</span></div>
  <div className="plan-grid plan-head"><span>#</span><span>Tävling</span><span>Datum</span><span>Ort</span><span>Arrangör</span><span></span></div>
  {rows.map((row,i)=><div className="plan-grid plan-row" key={i}>
   <strong>{existingCount+i+1}</strong>
   <input aria-label={`Namn deltävling ${existingCount+i+1}`} value={row.name} onChange={e=>update(i,'name',e.target.value)} placeholder={`Deltävling ${existingCount+i+1}`}/>
   <input aria-label="Datum" type="date" value={row.race_date} onChange={e=>update(i,'race_date',e.target.value)}/>
   <input aria-label="Ort" value={row.location} onChange={e=>update(i,'location',e.target.value)} placeholder="Ort"/>
   <select aria-label="Arrangör" value={row.organizer_club_id} onChange={e=>update(i,'organizer_club_id',e.target.value)}><option value="">Välj klubb</option>{clubs.map(c=><option value={c.id} key={c.id}>{c.name}</option>)}</select>
   <button type="button" className="plan-remove" aria-label="Ta bort rad" onClick={()=>setRows(current=>current.filter((_,n)=>n!==i))}>×</button>
  </div>)}
  <div className="plan-footer"><button type="button" className="secondary-dark" onClick={()=>setRows(r=>[...r,blank()])}>+ Lägg till deltävling</button><button type="submit" disabled={!active}>{existingCount?'Spara deltävling':'Spara tävlingsplan'}</button></div>
 </form>;
}