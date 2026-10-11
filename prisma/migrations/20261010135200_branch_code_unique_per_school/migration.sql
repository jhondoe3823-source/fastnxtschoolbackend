-- Branch codes should be unique per school, not globally.
-- Multiple schools can each have a default "MAIN" branch.
DROP INDEX IF EXISTS "branches_code_key";

CREATE UNIQUE INDEX "branches_schoolId_code_key" ON "branches"("schoolId", "code");
