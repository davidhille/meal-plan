-- Einmaliger Import aus dem Supabase-Backup (Profil mail@davidhille.de)
-- Erst die App einmal öffnen (legt die Tabellen an), dann dieses Skript im Neon SQL Editor.
-- Die 9 KI-Rezepte stecken direkt im Code (functions/_lib/meals.ts).

INSERT INTO profiles (id, health_goal, health_conditions)
VALUES ('f11fe406-ef64-47ab-b89c-11aed9d41137', 'balanced', '{gluten_free}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO family_members (id, profile_id, name, type, age, disliked_foods, favorite_foods, created_at)
VALUES ('ad4c2d34-6311-4c52-b238-be3480b804e3', 'f11fe406-ef64-47ab-b89c-11aed9d41137',
        'Papa', 'adult', NULL, '{Fisch}', '{}', '2026-07-24 14:48:29+00')
ON CONFLICT (id) DO NOTHING;
