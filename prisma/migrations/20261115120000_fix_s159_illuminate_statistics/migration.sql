-- S159 Illuminate (enemy 2): in the 15-minute bucket of 2026-07-20 08:00 UTC the official API's
-- cumulative counters jumped by 98,775,169 kills, 1,862,270,850 accidentals, 86,132,550 shots and
-- 662,147 hits, over a normal 17 missions and 73 deaths. That put S159 at 1144% on the /stats
-- Friendly Fire chart. Subtract the step from every row that carries it. The step's real share
-- (about 0.02% of each total) goes with it. Rows before the jump hold fewer than 60,000
-- accidentals, so the accidentals guard selects exactly the corrupt rows and leaves a database
-- without them unchanged.
UPDATE "h1_statistic"
SET "kills"       = "kills" - 98775169,
    "accidentals" = "accidentals" - 1862270850,
    "shots"       = "shots" - 86132550,
    "hits"        = "hits" - 662147
WHERE "season" = 159
  AND "enemy" = 2
  AND "accidentals" >= 1862270850;
