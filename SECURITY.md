# Security Policy

## Melaporkan celah keamanan

**Jangan buka GitHub issue publik untuk kerentanan keamanan.**

Laporkan secara privat lewat salah satu:

- **GitHub Security Advisories** — tab **Security** → **Report a vulnerability**
  (private vulnerability reporting).
- **Email** — deonpwa@gmail.com dengan subjek `[SECURITY] poker-chip-tracker`.

Sertakan langkah reproduksi, dampak, dan kalau bisa usulan perbaikan. Mohon beri
waktu wajar untuk patch sebelum diungkap ke publik.

## Versi yang didukung

Hanya branch `main` (deployment terbaru) yang dipelihara.

## Postur keamanan

- Setiap server action mengotorisasi dirinya sendiri (admin key cookie / sesi
  login) — bukan cuma gating di middleware/halaman.
- PIN di-hash dengan scrypt + perbandingan constant-time; login PIN di-throttle
  (lockout setelah beberapa percobaan gagal).
- Token sesi disimpan ter-hash (SHA-256), cookie `httpOnly` + `sameSite`.
- Endpoint admin balas `404` untuk key yang salah (tidak membocorkan keberadaannya).
- Semua query SQL parameterized (tanpa string concatenation).

## Di luar cakupan

- Akses ke instance/deployment milik orang lain.
- Serangan yang butuh kredensial korban (mis. PIN) yang sudah bocor di luar app.
