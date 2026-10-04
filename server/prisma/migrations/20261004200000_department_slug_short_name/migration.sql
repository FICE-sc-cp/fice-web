-- AlterTable
ALTER TABLE "Department" ADD COLUMN     "shortName" VARCHAR(50),
ADD COLUMN     "slug" VARCHAR(32);

-- Link the existing departments to their website pages by their current names.
UPDATE "Department" AS d
SET "slug" = p."slug", "shortName" = p."shortName"
FROM (
  SELECT DISTINCT ON (m."slug") dep."id", m."slug", m."shortName"
  FROM "Department" AS dep
  JOIN (VALUES
    ('projects',     'Проєктний департамент',                 'Проєктний'),
    ('media',        'Департамент медіа',                     'Медіа'),
    ('partnerships', 'Департамент партнерств',                'Партнерства'),
    ('merch',        'Департамент мерчу',                     'Мерч'),
    ('education',    'Департамент якості освіти',             'Якість освіти'),
    ('applicants',   'Департамент по роботі з абітурієнтами', 'Абітурієнти'),
    ('applicants',   'Департамент роботи з абітурієнтами',    'Абітурієнти')
  ) AS m("slug", "name", "shortName")
    ON lower(btrim(dep."name")) = lower(m."name")
  ORDER BY m."slug", dep."id"
) AS p
WHERE d."id" = p."id";

-- CreateIndex
CREATE UNIQUE INDEX "Department_slug_key" ON "Department"("slug");
