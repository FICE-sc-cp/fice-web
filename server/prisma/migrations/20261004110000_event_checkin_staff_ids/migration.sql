-- AlterTable
ALTER TABLE "Event" ADD COLUMN "checkInStaffIds" BIGINT[] DEFAULT ARRAY[]::BIGINT[];

UPDATE "Event" e
SET "checkInStaffIds" = resolved.ids
FROM (
  SELECT ev.id, array_agg(DISTINCT known."telegramId") AS ids
  FROM "Event" ev
  CROSS JOIN LATERAL unnest(ev."checkInStaffTags") AS t(tag)
  JOIN (
    SELECT lower("username") AS username, min("telegramId") AS "telegramId"
    FROM "BotUser"
    WHERE "username" IS NOT NULL
    GROUP BY lower("username")
    HAVING COUNT(*) = 1
  ) known ON known.username = lower(ltrim(t.tag, '@'))
  GROUP BY ev.id
) resolved
WHERE e.id = resolved.id;
