-- CreateTable
CREATE TABLE "VotingPartnerAward" (
    "id" UUID NOT NULL,
    "votingId" UUID NOT NULL,
    "eventPartnerId" UUID NOT NULL,
    "title" VARCHAR(80) NOT NULL,
    "prize" VARCHAR(160),
    "partnerPicks" BOOLEAN NOT NULL DEFAULT true,
    "showLogo" BOOLEAN NOT NULL DEFAULT true,
    "code" VARCHAR(32) NOT NULL,
    "candidateId" UUID,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VotingPartnerAward_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VotingPartnerAward_code_key" ON "VotingPartnerAward"("code");

-- CreateIndex
CREATE UNIQUE INDEX "VotingPartnerAward_votingId_eventPartnerId_key" ON "VotingPartnerAward"("votingId", "eventPartnerId");

-- AddForeignKey
ALTER TABLE "VotingPartnerAward" ADD CONSTRAINT "VotingPartnerAward_votingId_fkey" FOREIGN KEY ("votingId") REFERENCES "EventVoting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VotingPartnerAward" ADD CONSTRAINT "VotingPartnerAward_eventPartnerId_fkey" FOREIGN KEY ("eventPartnerId") REFERENCES "EventPartner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VotingPartnerAward" ADD CONSTRAINT "VotingPartnerAward_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "VotingCandidate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

