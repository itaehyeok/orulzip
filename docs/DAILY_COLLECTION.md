# Daily collection scheduler

MOLIT starts daily at 02:00 KST and KB at 05:00 KST. The production host timezone is Asia/Seoul; fixed clock times keep long collections from shifting the next day’s start. The host runner creates a provider log under the collector logs directory before redirecting output.

Run `scripts/install-daily-collection-cron.sh` as the service account on production. The installer requires `/etc/timezone` to report `Asia/Seoul` and the host clock to report `KST+0900`. Re-running replaces only lines carrying `# orulzip daily-collection` or the legacy `# orulzip molit-national-batch` marker, preserving unrelated crontab entries and removing the marked MOLIT batch and reboot lines.

The wrapper reads canonical compose from `/home/th/docker/custom/orulzip/production/docker-compose.data-collector.yml` and the existing environment file from `/home/th/docker/custom/orulzip/data-collector/.env`. It refuses to run unless the canonical checkout is clean on `main`, derives `ORULZIP_COLLECTOR_IMAGE=orulzip-collector:<main-commit>`, verifies that exact local image exists, and uses `--pull never`. It pins compose project `orulzip-data-collector`, uses the `daily-collection` one-shot service, and sets `ORULZIP_DB_INIT=0`. Host `flock` and PostgreSQL advisory locks prevent overlapping runs. Manual runs use `scripts/run-daily-collection.sh molit` or `scripts/run-daily-collection.sh kb`; extra arguments pass through to the child for smoke runs.

Each acquired run is persisted in `collection_runs`, including child failures such as quota-related exit codes. A later run recovers a prior still-running row only after it owns that provider’s advisory lock. Apply the migration and build the exact canonical `main` image through the deployment path before enabling cron, then install with `/home/th/docker/custom/orulzip/production/scripts/install-daily-collection-cron.sh`. Runtime initialization does not create the history schema.

The child entrypoints are `scripts/run-molit-daily-cycle.js` and `scripts/run-kb-daily-cycle.js`.

The activated image is stored in data-collector/active-collection-image by scripts/deploy-data-collection.sh. It is pinned to a full, integrated main commit and remains usable across unrelated web-only deployments. The canonical main wrapper validates the image and its ancestry before each run. Run the collector deploy script while holding the production lock after main integration; it builds the pinned image, applies tracked migrations, runs tests, stops superseded production loops, and installs the fixed schedule.

KB daily refresh covers every existing KB area type (22,127 at rollout), without rediscovering and re-crawling ten years of data every day. Each API response and price upsert is recorded transactionally in kb_daily_area_fetches. Successful empty responses for discontinued area types are distinct from failures. Retries resume successful areas from the current KST date. This does not imply national KB discovery is complete; the existing corpus contains Seoul/Gyeonggi/Bundang/Dongtan. Unfinished legacy discovery job records are preserved.

Historical MOLIT backfill now ends at the current KST month independently of KB publication dates, and health checks require every expected district/month pair since 201601. Default overall health also checks provider history, per-area KB fetch freshness, and the latest published KB price month. In-cycle MOLIT checks are explicitly scoped to MOLIT so one provider does not mask or block the other's repair.

After either provider finishes or fails, the runner saves a full overall health check after finalizing collection_runs. A scoped in-cycle MOLIT check cannot overwrite the final result and hide a KB failure. Health flags missing historical districts/months, stale recent districts, overdue/failed provider runs, and unrefreshed KB area types.

The active MOLIT master has 255 request codes. API probes confirm current codes also return historical transactions, while retired codes return zero. Previously verified legacy checkpoints through 202606 are accepted as complete history through a tested alias map, including grouped Incheon boundary changes. From 202607 onward only current-code checkpoints count. This preserves valid stored history without duplicating it and repairs the missing current-code coverage for August through October as well as July.

Collector deployment requires ORULZIP_PRODUCTION_LOCK_OWNER to match owner.json in the atomically acquired production lock. Hold that lock through integrated verification, rollout, and final production checks; an unrelated owner cannot deploy merely because a lock directory exists.

## Telegram completion notifications

The daily service passes the existing Telegram bot/chat configuration and enables successful health notifications. Each provider sends one labeled overall result only after its collection history is finalized. In-cycle MOLIT checks use --no-notify to prevent premature or duplicate messages. Telegram HTTP and JSON success plus message_id are required; the receipt or sanitized failure is stored in data_health_runs.summary.telegram. A required notification failure makes the runner exit nonzero while retaining the real collection outcome.

A requested one-off connection test uses scripts/run-daily-collection.sh molit --notification-test=UNIQUE-ID. It really upserts one current-month district, skips expensive cache rebuilds, acquires the normal host/advisory locks, and labels its message as a partial test with its DB row count. Tests do not create or renew full daily collection_runs history. Reusing a delivered test ID skips collection and messaging. Schedule it with a transient user systemd timer when a delayed test is requested.

Schema decision: no migration is required; notification metadata uses the existing JSONB summary and no table, index, or column contract changes.
