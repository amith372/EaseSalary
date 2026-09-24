-- The corpus: the text of a fetched page, kept beside the figure taken from it
-- rather than thrown away (specs.md Part 3, approved 2026-09-24).
--
-- The segmenting has stood since stage 5 (`src/lib/scrape/pageSections.ts`) and
-- every article fetch already produces it; what was missing was the far end, so
-- three scrapes a day segmented a page and discarded the result. The help
-- screen answers out of this text, and a corpus discarded here would have to be
-- scraped a second time to get it back.
--
-- **One row per address, and a re-fetch replaces it.** A page is the unit that
-- is fetched, so it is the unit that is written; the addressable unit inside it
-- is the heading, which is why `sections` keeps its anchors rather than being
-- flattened into one block. Appending instead of replacing would leave a
-- question answerable out of a page as it read last year.
--
-- **It belongs to the household** for the reason the rates, the holiday lists
-- and the brackets do. The text itself is a public page and identical for
-- everyone, but a table with no owner is a second isolation model kept for one
-- table's sake, and row-level security wants an owner.
create table public.cached_pages (
  household_id uuid not null references public.households (id) on delete cascade,

  -- The address the page was read from, which is also what a reference link in
  -- `src/lib/links.ts` points at, so the two resolve to one another.
  url text not null,

  -- The page's own title, as its heading gives it.
  title text not null,

  -- The sections, in the order the page prints them:
  -- `[{ anchor, heading, level, text }, ...]`, where `anchor` is the page's own
  -- heading id — the fragment a link ends in — and the lead paragraphs above
  -- the first heading are a section with an empty anchor.
  --
  -- **The order is part of the value**, as it is in `tax_brackets`: a section
  -- is read in the sequence the article argues in, and a question matched
  -- against a shuffled page answers out of the wrong one.
  sections jsonb not null
    check (jsonb_typeof(sections) = 'array' and jsonb_array_length(sections) >= 1),

  fetched_at timestamptz not null default now(),

  primary key (household_id, url)
);

alter table public.cached_pages enable row level security;
alter table public.cached_pages force row level security;

create policy cached_pages_all on public.cached_pages
  for all to authenticated
  using ((select private.is_household_member(household_id)))
  with check ((select private.is_household_member(household_id)));

grant select, insert, update, delete on public.cached_pages to authenticated;
revoke all on public.cached_pages from anon;
