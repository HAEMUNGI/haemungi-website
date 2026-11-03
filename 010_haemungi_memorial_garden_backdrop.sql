-- Allow separate administrator control of the outer garden and the original central entrance artwork.
alter table public.hm_memorial_scene_settings
  drop constraint if exists hm_memorial_scene_settings_scene_key_check;
alter table public.hm_memorial_scene_settings
  add constraint hm_memorial_scene_settings_scene_key_check
  check (scene_key in ('garden_backdrop','entrance_cover','hall_cover','ritual_cover'));
