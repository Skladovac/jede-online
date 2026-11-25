-- Výchozí údaje: makléři jsou v oboru více než 15 let (podle zadání 14. 10. 2026). Další čísla doplní v administraci.
INSERT INTO "TeamSettings" ("id", "yearsInField") VALUES (1, 15) ON CONFLICT ("id") DO NOTHING;
UPDATE "User" SET "yearsInField" = 15 WHERE "yearsInField" IS NULL;
