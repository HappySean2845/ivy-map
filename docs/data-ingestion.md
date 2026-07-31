# Official university data ingestion

The official-source crawler runs locally. Downloaded HTML, PDF, Excel, CSV, manifests, and generated import SQL live under `.data/` and are ignored by Git. PostgreSQL stores only normalized catalog, crawl, link, artifact metadata, and parsed facts—not binary source files.

## Local crawl

Validate the 30-source seed without network requests:

```bash
pnpm data:crawl:official -- --dry-run
```

Run a bounded crawl (four source pages concurrently, at most twelve direct documents per source, maximum 25 MB per response):

```bash
pnpm data:crawl:official
```

Retry only selected sources after correcting an official URL:

```bash
pnpm data:crawl:official -- --source-ids berkeley-official,columbia-official --run-id retry-1
```

The document queue also has a three-minute per-source budget so one slow archive cannot hold the entire run indefinitely.

The command prints the run directory and writes:

```text
.data/runs/<runId>/
  artifacts/
  manifest.json
```

Failed or blocked URLs remain in the manifest with an explicit status. Re-running with the same `--run-id` is safe locally because artifact filenames are content-addressed.

## Fly PostgreSQL

The shared Fly cluster is `llm-gateway-pg`, but Ivy Map uses a separate `ivy_map` database owned by the non-login `ivy_map_owner` role. Existing gateway databases and roles are not modified.

This is logical Hackathon isolation, not a hard security boundary. Existing gateway application roles are members of PostgreSQL's predefined `pg_read_all_data` / `pg_write_all_data` roles, so they can access every database in the cluster. Do not revoke those memberships without auditing and migrating the gateway applications.

Apply the tracked schema:

```bash
flyctl ssh console -a llm-gateway-pg \
  -C "sh -lc 'export PGPASSWORD=\"\$OPERATOR_PASSWORD\"; psql -h \"\$FLY_APP_NAME.internal\" -p 5432 -U postgres -d ivy_map -v ON_ERROR_STOP=1 -f -'" \
  < db/migrations/0001_ingestion.sql
```

Generate an idempotent SQL import from a crawl manifest:

```bash
pnpm data:import:sql -- --manifest .data/runs/<runId>/manifest.json
flyctl ssh console -a llm-gateway-pg \
  -C "sh -lc 'export PGPASSWORD=\"\$OPERATOR_PASSWORD\"; psql -h \"\$FLY_APP_NAME.internal\" -p 5432 -U postgres -d ivy_map -v ON_ERROR_STOP=1 -f -'" \
  < .data/runs/<runId>/import.sql
```

The import runs in one transaction and uses upserts. Importing the same run twice does not duplicate rows.

## Reviewed observations

Raw extraction and review manifests stay under ignored `.data/reviewed/`. Each observation must name its institution, academic year, official source artifact SHA-256, numeric value, dimensions, and precise PDF page or worksheet cell.

Generate and load an idempotent reviewed-observation import:

```bash
pnpm data:observations:sql -- --input .data/reviewed/observations.json
flyctl ssh console -a llm-gateway-pg \
  -C "sh -lc 'export PGPASSWORD=\"\$OPERATOR_PASSWORD\"; psql -h \"\$FLY_APP_NAME.internal\" -p 5432 -U postgres -d ivy_map -v ON_ERROR_STOP=1 -f -'" \
  < .data/reviewed/import.sql
```

The SQL builder accepts the three canonical CDS C1 totals (`applied`, `admitted`, and `enrolled`). It resolves the corresponding `source_artifacts` row by source ID and SHA-256, writes `review_status = 'reviewed'`, and uses a stable logical hash so a corrected value updates instead of duplicating the observation.

## Scope and trust boundary

- `data/seeds/university-official-sources.csv` contains the 21 US CDS entry pages and 9 non-US official statistics pages from the supplied DOCX.
- The DOCX's media/intermediary admissions estimates are not imported as official data.
- A discovered link is not a published fact. Parsed observations remain `extracted` until reviewed.
- University of Washington uses stable ID `uw`; it must never be fuzzy-merged with Washington University in St. Louis.
- CMU's first reviewed C1 record is Pittsburgh-campus only; UW's is Seattle-campus only. Those scopes are preserved in observation dimensions.
