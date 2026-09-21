-- Add only the theme preference; safe to re-run on existing installations.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "theme" TEXT NOT NULL DEFAULT 'dark';
