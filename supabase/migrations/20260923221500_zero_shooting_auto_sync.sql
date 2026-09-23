create unique index if not exists zero_shooting_club_source_result_uidx on public.zero_shooting_club(source_result_id) where source_result_id is not null;
create unique index if not exists zero_shooting_club_source_external_result_uidx on public.zero_shooting_club(source_external_result_id) where source_external_result_id is not null;

create or replace function public.sync_zero_shooting_from_result()
returns trigger language plpgsql security invoker set search_path=public as $$
declare v_name text; v_club text; v_class text; v_event text; v_date date; v_season text; v_medal text;
begin
 if new.shooting_shots is null or new.shooting_shots<=0 or new.shooting_hits is distinct from new.shooting_shots then return new; end if;
 select a.full_name,coalesce(rc.name,ac.name),c.name,ra.name,ra.race_date,
 case when extract(month from ra.race_date) between 5 and 11 then extract(year from ra.race_date)::int||' Sommar' else extract(year from ra.race_date)::int||' Vinter' end,
 case when c.name~*'(10-11|12-13)' and c.name!~*'(nybörj|öppen)' then 'bronze' when c.name~*'14-15' then 'silver' when c.name~*'(16|17|18|19|20|21|22|senior|junior)' then 'gold' end
 into v_name,v_club,v_class,v_event,v_date,v_season,v_medal
 from public.athletes a join public.classes c on c.id=new.class_id join public.races ra on ra.id=new.race_id left join public.clubs rc on rc.id=new.club_id left join public.clubs ac on ac.id=a.club_id where a.id=new.athlete_id;
 if v_medal is null or exists(select 1 from public.zero_shooting_club where source_result_id=new.id) then return new; end if;
 insert into public.zero_shooting_club(athlete_id,athlete_name,club_name,season_label,event_name,event_date,class_name,medal_level,source_type,source_result_id,verified)
 values(new.athlete_id,v_name,v_club,v_season,v_event,v_date,v_class,v_medal,'syd_cup',new.id,true) on conflict do nothing; return new;
end $$;
drop trigger if exists sync_zero_shooting_result_trigger on public.results;
create trigger sync_zero_shooting_result_trigger after insert or update of shooting_hits,shooting_shots on public.results for each row execute function public.sync_zero_shooting_from_result();

create or replace function public.sync_zero_shooting_from_external_result()
returns trigger language plpgsql security invoker set search_path=public as $$
declare v_medal text; v_season text;
begin
 if new.shooting_shots is null or new.shooting_shots<=0 or new.shooting_hits is distinct from new.shooting_shots then return new; end if;
 v_medal:=case when new.class_name~*'(10-11|12-13)' and new.class_name!~*'(nybörj|öppen)' then 'bronze' when new.class_name~*'14-15' then 'silver' when new.class_name~*'(16|17|18|19|20|21|22|senior|junior|wjun|mjun|^[dh]$)' then 'gold' end;
 if v_medal is null then return new; end if;
 v_season:=case when new.event_date is null then null when extract(month from new.event_date) between 5 and 11 then extract(year from new.event_date)::int||' Sommar' else extract(year from new.event_date)::int||' Vinter' end;
 insert into public.zero_shooting_club(athlete_id,athlete_name,club_name,season_label,event_name,event_date,class_name,medal_level,source_type,source_external_result_id,verified)
 values(new.athlete_id,new.external_athlete_name,new.club_name,v_season,new.event_name,new.event_date,new.class_name,v_medal,'external',new.id,true) on conflict do nothing; return new;
end $$;
drop trigger if exists sync_zero_shooting_external_result_trigger on public.external_results;
create trigger sync_zero_shooting_external_result_trigger after insert or update of shooting_hits,shooting_shots on public.external_results for each row execute function public.sync_zero_shooting_from_external_result();