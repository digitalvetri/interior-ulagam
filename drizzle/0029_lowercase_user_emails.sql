-- Better Auth lowercases the email at sign-in, so a staff email stored with
-- capitals could never log in. Normalise existing rows; skip any row whose
-- lowercased form already belongs to another account (left for manual review)
-- so this can never fail on the unique constraint.
UPDATE "users" u
SET "email" = lower(trim(u."email"))
WHERE u."email" IS NOT NULL
  AND u."email" <> lower(trim(u."email"))
  AND NOT EXISTS (
    SELECT 1 FROM "users" o
    WHERE o."id" <> u."id" AND o."email" = lower(trim(u."email"))
  );
