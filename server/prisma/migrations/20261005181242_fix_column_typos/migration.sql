-- Fix column name typos from the initial migration (rename keeps existing data)
ALTER TABLE "users" RENAME COLUMN "firsTime" TO "firstTime";
ALTER TABLE "user_quiz_responses" RENAME COLUMN "prferredCountries" TO "preferredCountries";
