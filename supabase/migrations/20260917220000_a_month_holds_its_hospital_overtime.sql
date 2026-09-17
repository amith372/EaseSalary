-- What the family chose to pay for hours in hospital this month, or nothing
-- (specs.md item 20). Typed and never calculated: a live-in caregiver has no
-- statutory overtime. The note belongs to the amount, so there is no note
-- without one.
alter table public.months
  add column hospital_overtime_agorot integer
    check (hospital_overtime_agorot > 0),
  add column hospital_overtime_note text,
  add constraint months_hospital_overtime_note_needs_amount
    check (hospital_overtime_note is null or hospital_overtime_agorot is not null);
