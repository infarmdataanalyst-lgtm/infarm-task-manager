-- Atur / ganti PIN tim desain (6 angka).
-- Ganti 123456 di bawah dengan PIN pilihan Anda, lalu Run di Supabase SQL Editor.
-- PIN tidak disimpan apa adanya, hanya hash SHA-256-nya.
-- Setelah PIN diganti, semua perangkat tim otomatis diminta memasukkan PIN baru.

insert into public.app_settings (key, value)
values ('team_pin_sha256', encode(extensions.digest('123456', 'sha256'), 'hex'))
on conflict (key) do update set value = excluded.value;
