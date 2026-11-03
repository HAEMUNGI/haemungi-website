-- Image-frame editor: independent 4-corner placement and image fitting.
-- Existing approved media and photos are left unchanged.
alter table public.hm_memorial_public
  add column if not exists frame_corners jsonb,
  add column if not exists frame_fit text not null default 'cover',
  add column if not exists frame_mat_color text not null default '#f4ead8';

alter table public.hm_memorial_public
  add constraint hm_memorial_public_frame_fit_valid
  check (frame_fit in ('cover','contain'));

alter table public.hm_memorial_public
  add constraint hm_memorial_public_frame_mat_valid
  check (frame_mat_color ~ '^#[0-9a-fA-F]{6}$');

alter table public.hm_memorial_public
  add constraint hm_memorial_public_frame_corners_shape
  check (case when frame_corners is null then true
    when jsonb_typeof(frame_corners)<>'array' then false
    else jsonb_array_length(frame_corners)=4 and
      octet_length(frame_corners::text)<400 end);
