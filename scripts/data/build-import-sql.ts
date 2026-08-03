import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

interface Attempt {
  artifactKind: 'index_page' | 'document'
  requestedUrl: string
  finalUrl: string | null
  status: string
  httpStatus: number | null
  mimeType: string | null
  byteSize: number | null
  sha256: string | null
  localPath: string | null
  etag: string | null
  lastModified: string | null
  fetchedAt: string
  errorDetail: string | null
}

interface Manifest {
  schemaVersion: number
  runId: string
  toolVersion: string
  seedFile: string
  startedAt: string
  finishedAt: string
  status: string
  summary: Record<string, number>
  sources: Array<{
    seed: {
      source_id: string
      institution_id: string
      name_local: string
      name_en: string
      country_code: string
      dataset_kind: string
      canonical_url: string
      fallback_url?: string
      current_artifact_url?: string
      institution_kind?: 'university' | 'high_school' | 'government' | 'system'
      source_type?: 'official' | 'government' | 'media' | 'report' | 'crowdsourced'
      confidence?: 'L1' | 'L2' | 'L3'
      source_title?: string
    }
    root: Attempt
    discoveredLinks: Array<{
      url: string
      text: string
      kind: string
      editionLabel: string | null
    }>
    documents: Attempt[]
  }>
}

function arg(name: string): string | null {
  const index = process.argv.indexOf(name)
  return index >= 0 ? (process.argv[index + 1] ?? null) : null
}

function sql(value: unknown): string {
  if (value == null) return 'NULL'
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NULL'
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE'
  return `'${String(value).replace(/\0/g, '').replace(/'/g, "''")}'`
}

function main() {
  const manifestArg = arg('--manifest')
  if (!manifestArg)
    throw new Error(
      'usage: pnpm data:import:sql -- --manifest .data/runs/<runId>/manifest.json',
    )
  const manifestPath = resolve(manifestArg)
  const manifestText = readFileSync(manifestPath, 'utf8')
  const manifest = JSON.parse(manifestText) as Manifest
  if (manifest.schemaVersion !== 1)
    throw new Error(`unsupported manifest schema: ${manifest.schemaVersion}`)

  const statements: string[] = [
    '\\set ON_ERROR_STOP on',
    'BEGIN;',
    `INSERT INTO crawl_runs (run_id, tool_version, seed_file, started_at, finished_at, status, seed_count, fetched_source_count, failed_source_count, artifact_count, discovered_link_count, manifest_sha256) VALUES (${sql(manifest.runId)}, ${sql(manifest.toolVersion)}, ${sql(manifest.seedFile)}, ${sql(manifest.startedAt)}, ${sql(manifest.finishedAt)}, ${sql(manifest.status)}, ${sql(manifest.summary.seedCount)}, ${sql(manifest.summary.fetchedSourceCount)}, ${sql(manifest.summary.failedSourceCount)}, ${sql(manifest.summary.artifactCount)}, ${sql(manifest.summary.discoveredLinkCount)}, ${sql(createHash('sha256').update(manifestText).digest('hex'))}) ON CONFLICT (run_id) DO UPDATE SET finished_at = EXCLUDED.finished_at, status = EXCLUDED.status, fetched_source_count = EXCLUDED.fetched_source_count, failed_source_count = EXCLUDED.failed_source_count, artifact_count = EXCLUDED.artifact_count, discovered_link_count = EXCLUDED.discovered_link_count, manifest_sha256 = EXCLUDED.manifest_sha256;`,
  ]

  for (const source of manifest.sources) {
    const seed = source.seed
    const accessAttempt =
      source.root.status === 'fetched'
        ? source.root
        : (source.documents.find((attempt) => attempt.status === 'fetched') ?? source.root)
    const accessStatus =
      source.root.status === 'fetched'
        ? 'fetched'
        : accessAttempt.status === 'fetched'
          ? 'fallback_fetched'
          : source.root.status
    const institutionKind = seed.institution_kind || 'university'
    const sourceType = seed.source_type || 'official'
    const confidence = seed.confidence || 'L1'
    const sourceTitle =
      seed.source_title ||
      `${seed.name_en} official ${seed.dataset_kind === 'cds' ? 'Common Data Set' : 'statistics'}`
    statements.push(
      `INSERT INTO institutions (id, kind, name_en, name_local, country_code, status) VALUES (${sql(seed.institution_id)}, ${sql(institutionKind)}, ${sql(seed.name_en)}, ${sql(seed.name_local)}, ${sql(seed.country_code)}, 'active') ON CONFLICT (id) DO UPDATE SET kind = EXCLUDED.kind, name_en = EXCLUDED.name_en, name_local = EXCLUDED.name_local, country_code = EXCLUDED.country_code, updated_at = now();`,
      `INSERT INTO sources (id, institution_id, source_type, dataset_kind, title, canonical_url, confidence, access_status, http_status, final_url, error_detail, first_seen_at, last_checked_at) VALUES (${sql(seed.source_id)}, ${sql(seed.institution_id)}, ${sql(sourceType)}, ${sql(seed.dataset_kind)}, ${sql(sourceTitle)}, ${sql(seed.canonical_url)}, ${sql(confidence)}, ${sql(accessStatus)}, ${sql(accessAttempt.httpStatus)}, ${sql(accessAttempt.finalUrl)}, ${sql(accessAttempt.errorDetail)}, ${sql(source.root.fetchedAt)}, ${sql(source.root.fetchedAt)}) ON CONFLICT (id) DO UPDATE SET source_type = EXCLUDED.source_type, dataset_kind = EXCLUDED.dataset_kind, title = EXCLUDED.title, canonical_url = EXCLUDED.canonical_url, confidence = EXCLUDED.confidence, access_status = EXCLUDED.access_status, http_status = EXCLUDED.http_status, final_url = EXCLUDED.final_url, error_detail = EXCLUDED.error_detail, last_checked_at = EXCLUDED.last_checked_at;`,
    )

    for (const attempt of [source.root, ...source.documents]) {
      statements.push(
        `INSERT INTO crawl_attempts (run_id, source_id, artifact_kind, requested_url, final_url, status, http_status, mime_type, byte_size, sha256, local_path, etag, last_modified, fetched_at, error_detail) VALUES (${sql(manifest.runId)}, ${sql(seed.source_id)}, ${sql(attempt.artifactKind)}, ${sql(attempt.requestedUrl)}, ${sql(attempt.finalUrl)}, ${sql(attempt.status)}, ${sql(attempt.httpStatus)}, ${sql(attempt.mimeType)}, ${sql(attempt.byteSize)}, ${sql(attempt.sha256)}, ${sql(attempt.localPath)}, ${sql(attempt.etag)}, ${sql(attempt.lastModified)}, ${sql(attempt.fetchedAt)}, ${sql(attempt.errorDetail)}) ON CONFLICT (run_id, source_id, requested_url) DO UPDATE SET final_url = EXCLUDED.final_url, status = EXCLUDED.status, http_status = EXCLUDED.http_status, mime_type = EXCLUDED.mime_type, byte_size = EXCLUDED.byte_size, sha256 = EXCLUDED.sha256, local_path = EXCLUDED.local_path, etag = EXCLUDED.etag, last_modified = EXCLUDED.last_modified, fetched_at = EXCLUDED.fetched_at, error_detail = EXCLUDED.error_detail;`,
      )
      if (attempt.status === 'fetched' && attempt.sha256) {
        statements.push(
          `INSERT INTO source_artifacts (source_id, first_seen_run_id, last_seen_run_id, artifact_kind, requested_url, final_url, sha256, mime_type, byte_size, local_path, etag, last_modified, captured_at) VALUES (${sql(seed.source_id)}, ${sql(manifest.runId)}, ${sql(manifest.runId)}, ${sql(attempt.artifactKind)}, ${sql(attempt.requestedUrl)}, ${sql(attempt.finalUrl)}, ${sql(attempt.sha256)}, ${sql(attempt.mimeType)}, ${sql(attempt.byteSize)}, ${sql(attempt.localPath)}, ${sql(attempt.etag)}, ${sql(attempt.lastModified)}, ${sql(attempt.fetchedAt)}) ON CONFLICT (source_id, sha256) DO UPDATE SET last_seen_run_id = EXCLUDED.last_seen_run_id, requested_url = EXCLUDED.requested_url, final_url = EXCLUDED.final_url, mime_type = EXCLUDED.mime_type, byte_size = EXCLUDED.byte_size, local_path = EXCLUDED.local_path, etag = EXCLUDED.etag, last_modified = EXCLUDED.last_modified, captured_at = EXCLUDED.captured_at;`,
        )
      }
    }

    for (const link of source.discoveredLinks) {
      statements.push(
        `INSERT INTO source_links (source_id, first_seen_run_id, last_seen_run_id, discovered_url, link_text, link_kind, edition_label) VALUES (${sql(seed.source_id)}, ${sql(manifest.runId)}, ${sql(manifest.runId)}, ${sql(link.url)}, ${sql(link.text)}, ${sql(link.kind)}, ${sql(link.editionLabel)}) ON CONFLICT (source_id, discovered_url) DO UPDATE SET last_seen_run_id = EXCLUDED.last_seen_run_id, link_text = EXCLUDED.link_text, link_kind = EXCLUDED.link_kind, edition_label = COALESCE(EXCLUDED.edition_label, source_links.edition_label);`,
      )
    }
  }

  statements.push(
    `UPDATE crawl_runs SET imported_at = now() WHERE run_id = ${sql(manifest.runId)};`,
    'COMMIT;',
    '',
  )
  const outputPath = resolve(dirname(manifestPath), 'import.sql')
  writeFileSync(outputPath, statements.join('\n'))
  console.log(outputPath)
}

main()
