-- Ruleset class scoring and dynamic drop schedule.
-- Production migration also recreates cup_result_points to use these class rules
-- and cup_result_breakdown to use cup_drop_count_for_ruleset().
create table if not exists public.cup_ruleset_class_rules (
 id uuid primary key default gen_random_uuid(),
 ruleset_id uuid not null references public.cup_rulesets(id) on delete cascade,
 class_id uuid not null references public.classes(id) on delete cascade,
 scoring_mode text not null default 'standard' check (scoring_mode in ('standard','fixed','none')),
 fixed_points integer check (fixed_points is null or fixed_points >= 0),
 medal_eligible boolean not null default true,
 unique(ruleset_id,class_id)
);
