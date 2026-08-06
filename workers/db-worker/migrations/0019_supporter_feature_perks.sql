-- 0019_supporter_feature_perks.sql — group-granted feature access.
--
-- Background assignments remain in premiumSupporterGroupPerks because they
-- also drive protected R2 capabilities. This sibling table holds revocable
-- access to app surfaces. The Worker validates every featureId against its
-- typed catalog before returning or mutating it.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS premiumSupporterGroupFeatures (
  groupId TEXT NOT NULL,
  featureId TEXT NOT NULL,
  assignedAt TEXT NOT NULL,
  revokedAt TEXT,
  PRIMARY KEY (groupId, featureId),
  FOREIGN KEY (groupId) REFERENCES premiumSupporterGroups(id)
    ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_premiumSupporterGroupFeatures_feature
  ON premiumSupporterGroupFeatures (featureId, revokedAt);

-- Every current supporter receives Lab access. The same perk remains
-- independently assignable to manual groups such as founders or testers.
INSERT OR IGNORE INTO premiumSupporterGroupFeatures
  (groupId, featureId, assignedAt, revokedAt)
SELECT id, 'lab-access', '2026-08-06T00:00:00.000Z', NULL
  FROM premiumSupporterGroups
 WHERE slug = 'active-supporters'
   AND kind = 'automatic'
   AND deletedAt IS NULL;

-- Pricing copy is database-driven. Append the shipped benefit without
-- replacing any operator-authored tier bullets, and make replay idempotent.
UPDATE pricingPlans
   SET perks = CASE
     WHEN perks IS NULL OR json_valid(perks) = 0
       THEN json_array('MercuryPitch Lab: beta and development features')
     WHEN NOT EXISTS (
       SELECT 1
         FROM json_each(
           CASE WHEN json_valid(perks) THEN perks ELSE '[]' END
         )
        WHERE value = 'MercuryPitch Lab: beta and development features'
     )
       THEN json_insert(perks, '$[#]',
         'MercuryPitch Lab: beta and development features')
     ELSE perks
   END,
       updatedAt = '2026-08-06T00:00:00.000Z'
 WHERE kind = 'donation'
   AND (
     perks IS NULL
     OR json_valid(perks) = 0
     OR NOT EXISTS (
       SELECT 1
         FROM json_each(
           CASE WHEN json_valid(perks) THEN perks ELSE '[]' END
         )
        WHERE value = 'MercuryPitch Lab: beta and development features'
     )
   );
