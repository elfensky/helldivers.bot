-- DropForeignKey
ALTER TABLE "h1_event_snapshot" DROP CONSTRAINT "h1_event_snapshot_season_fkey";

-- DropForeignKey
ALTER TABLE "h1_event_snapshot" DROP CONSTRAINT "h1_event_snapshot_type_event_id_fkey";

-- DropForeignKey
ALTER TABLE "h1_introduction_order" DROP CONSTRAINT "h1_introduction_order_season_fkey";

-- DropForeignKey
ALTER TABLE "h1_live" DROP CONSTRAINT "h1_live_season_fkey";

-- DropForeignKey
ALTER TABLE "h1_live_snapshot" DROP CONSTRAINT "h1_live_snapshot_season_fkey";

-- DropForeignKey
ALTER TABLE "h1_points_max" DROP CONSTRAINT "h1_points_max_season_fkey";

-- DropForeignKey
ALTER TABLE "h1_snapshot" DROP CONSTRAINT "h1_snapshot_season_fkey";

-- RenameColumn (data-preserving rename, NOT drop+add)
ALTER TABLE "h1_season" RENAME COLUMN "intro_order_array" TO "introduction_order";
ALTER TABLE "h1_season" RENAME COLUMN "points_max_array" TO "points_max";

-- DropTable
DROP TABLE "h1_event_snapshot";

-- DropTable
DROP TABLE "h1_introduction_order";

-- DropTable
DROP TABLE "h1_live";

-- DropTable
DROP TABLE "h1_live_snapshot";

-- DropTable
DROP TABLE "h1_points_max";

-- DropTable
DROP TABLE "h1_snapshot";

-- DropTable
DROP TABLE "rebroadcast_snapshot";

-- DropTable
DROP TABLE "rebroadcast_status";
