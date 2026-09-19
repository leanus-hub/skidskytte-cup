-- Keep age classes first; beginner/open classes are age-independent and shown last.
update public.classes set sort_order=case name
when 'Flickor 10-11' then 10 when 'Pojkar 10-11' then 20
when 'Flickor 12-13' then 30 when 'Pojkar 12-13' then 40
when 'Flickor 14-15' then 50 when 'Pojkar 14-15' then 60
when 'Damer 16-17' then 70 when 'Herrar 16-17' then 80
when 'Damer 18-21' then 90 when 'Herrar 18-21' then 100
when 'Damer Senior' then 110 when 'Herrar Senior' then 120
when 'Flickor Nybörjare' then 900 when 'Pojkar Nybörjare' then 910
when 'Öppen Klass' then 920 else sort_order end where is_official=true;