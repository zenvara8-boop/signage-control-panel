-- Signage Control Panel: skema database (Supabase / Postgres)
-- Jalankan seluruh file ini di Supabase Dashboard > SQL Editor.

create extension if not exists "pgcrypto";

create table if not exists playlists (
  id         uuid primary key default gen_random_uuid(),
  nama       text not null,
  created_at timestamptz not null default now()
);

create table if not exists devices (
  id          uuid primary key default gen_random_uuid(),
  nama        text not null,
  lokasi      text,
  status      text not null default 'offline' check (status in ('online', 'offline')),
  last_seen   timestamptz,
  playlist_id uuid references playlists(id) on delete set null,
  created_at  timestamptz not null default now()
);

create table if not exists contents (
  id         uuid primary key default gen_random_uuid(),
  judul      text not null,
  tipe       text not null check (tipe in ('image', 'video', 'text', 'url')),
  payload    text not null,  -- image/video: URL file di Storage; text: isi teks; url: tautan
  created_at timestamptz not null default now()
);

create table if not exists playlist_items (
  id           uuid primary key default gen_random_uuid(),
  playlist_id  uuid not null references playlists(id) on delete cascade,
  content_id   uuid not null references contents(id) on delete cascade,
  urutan       int  not null default 0,
  durasi_detik int  not null default 10 check (durasi_detik between 1 and 3600)
);

create table if not exists admins (
  id            uuid primary key default gen_random_uuid(),
  username      text unique not null,
  password_hash text not null
);

create index if not exists idx_playlist_items_playlist on playlist_items(playlist_id, urutan);
create index if not exists idx_playlist_items_content  on playlist_items(content_id);
create index if not exists idx_devices_playlist        on devices(playlist_id);

-- Semua akses data lewat backend (service role). RLS diaktifkan tanpa policy
-- supaya anon key tidak bisa membaca/menulis tabel secara langsung.
alter table playlists       enable row level security;
alter table devices         enable row level security;
alter table contents        enable row level security;
alter table playlist_items  enable row level security;
alter table admins          enable row level security;

-- Bucket Storage publik untuk file gambar/video.
insert into storage.buckets (id, name, public)
values ('contents', 'contents', true)
on conflict (id) do nothing;
