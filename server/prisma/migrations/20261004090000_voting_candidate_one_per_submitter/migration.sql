DO $$
DECLARE
  duplicates INTEGER;
BEGIN
  SELECT COUNT(*) INTO duplicates FROM (
    SELECT "votingId", "submittedByTelegramId"
    FROM "VotingCandidate"
    WHERE "submittedByTelegramId" IS NOT NULL
    GROUP BY "votingId", "submittedByTelegramId"
    HAVING COUNT(*) > 1
  ) d;
  IF duplicates > 0 THEN
    RAISE EXCEPTION 'Migration voting_candidate_one_per_submitter: % (votingId, submittedByTelegramId) pair(s) have more than one VotingCandidate row. Nothing was changed. List them with: SELECT "votingId", "submittedByTelegramId", array_agg(id) FROM "VotingCandidate" WHERE "submittedByTelegramId" IS NOT NULL GROUP BY 1, 2 HAVING COUNT(*) > 1; then delete or merge the extra rows in the admin and redeploy.', duplicates;
  END IF;
END $$;

-- CreateIndex
CREATE UNIQUE INDEX "VotingCandidate_votingId_submittedByTelegramId_key" ON "VotingCandidate"("votingId", "submittedByTelegramId");
