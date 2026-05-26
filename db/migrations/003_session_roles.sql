-- no_gaji_dealer: player deals cards but pays nothing and earns nothing
ALTER TABLE session_participants ADD COLUMN no_gaji_dealer BOOLEAN NOT NULL DEFAULT false;
