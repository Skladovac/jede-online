-- Jazyk webu a e-mailů uživatele.
ALTER TABLE "User" ADD COLUMN "locale" VARCHAR(5) NOT NULL DEFAULT 'cs';
