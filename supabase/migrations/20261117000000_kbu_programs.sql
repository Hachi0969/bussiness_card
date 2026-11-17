-- Adds the Kasem Bundit programs. Must match the program ids in public/config.js.
-- The old placeholder ids stay so existing test entries remain valid.
insert into private.programs (id) values
  ('dti'), ('thai-foreigners'), ('hotel-restaurant'), ('civil-eng'), ('lang-comm-intl'),
  ('aviation-intl'), ('mgmt-entrepreneur'), ('fashion-design'), ('lang-comm')
on conflict do nothing;
