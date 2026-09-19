-- Display official classes by age group, alternating girls/women then boys/men.
update public.classes set sort_order=case name
when 'Flickor Nybörjare' then 10 when 'Pojkar Nybörjare' then 20
when 'Flickor 10-11' then 30 when 'Pojkar 10-11' then 40
when 'Flickor 12-13' then 50 when 'Pojkar 12-13' then 60
when 'Flickor 14-15' then 70 when 'Pojkar 14-15' then 80
when 'Damer 16-17' then 90 when 'Herrar 16-17' then 100
when 'Damer 18-21' then 110 when 'Herrar 18-21' then 120
when 'Damer Senior' then 130 when 'Herrar Senior' then 140
when 'Öppen Klass' then 999 else sort_order end
where is_official=true;
