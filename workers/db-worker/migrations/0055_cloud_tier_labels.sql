-- 0055_cloud_tier_labels.sql — the separation tiers say "Cloud", as the rest of the app does.
--
-- Settings › Credits titles its processing cards from these rows. Everywhere
-- else the paid separation is the Cloud GPU, so "Server (GPU)" sat above a
-- cost guide that said "Cloud GPU" and read as a second thing. The CPU tier,
-- not launched yet, takes the matching name.
--
-- Labels only: ids, prices, badges and order are untouched, and nothing
-- matches on a label. Rows that do not exist (a fresh preview database)
-- update nothing.

UPDATE pricingPlans
SET label = 'Cloud GPU', updatedAt = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE id = 'tier-runpod-gpu';

UPDATE pricingPlans
SET label = 'Cloud CPU', updatedAt = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE id = 'tier-runpod-cpu';
