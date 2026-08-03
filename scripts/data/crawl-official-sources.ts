import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import Papa from 'papaparse'
import {
  extensionFor,
  extractRelevantLinks,
  type DiscoveredLink,
} from '../../lib/ingestion/html.js'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const DEFAULT_SEED = resolve(ROOT, 'data/seeds/university-official-sources.csv')
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36 IVYMapResearch/0.1'

interface SeedRow {
  source_id: string
  institution_id: string
  name_local: string
  name_en: string
  country_code: string
  dataset_kind: 'cds' | 'facts'
  canonical_url: string
  fallback_url?: string
  current_artifact_url?: string
}

interface ArtifactAttempt {
  artifactKind: 'index_page' | 'document'
  requestedUrl: string
  finalUrl: string | null
  status: 'fetched' | 'http_error' | 'timeout' | 'too_large' | 'network_error'
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

interface SourceResult {
  seed: SeedRow
  root: ArtifactAttempt
  discoveredLinks: DiscoveredLink[]
  documents: ArtifactAttempt[]
}

interface CrawlManifest {
  schemaVersion: 1
  runId: string
  toolVersion: string
  seedFile: string
  startedAt: string
  finishedAt: string
  status: 'completed' | 'partial' | 'failed'
  summary: {
    seedCount: number
    fetchedSourceCount: number
    failedSourceCount: number
    artifactCount: number
    discoveredLinkCount: number
  }
  sources: SourceResult[]
}

interface Options {
  seedFile: string
  runId: string
  concurrency: number
  maxDocumentsPerSource: number
  maxBytes: number
  documentBudgetMs: number
  sourceIds: Set<string> | null
  dryRun: boolean
}

function readArg(name: string): string | null {
  const index = process.argv.indexOf(name)
  return index >= 0 ? (process.argv[index + 1] ?? null) : null
}

function positiveInteger(value: string | null, fallback: number, name: string): number {
  if (value == null) return fallback
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0)
    throw new Error(`${name} must be a positive integer`)
  return parsed
}

function defaultRunId(): string {
  return new Date()
    .toISOString()
    .replace(/\.\d{3}Z$/, 'Z')
    .replace(/[:]/g, '')
    .replace('T', '-')
}

function parseOptions(): Options {
  return {
    seedFile: resolve(readArg('--seed') ?? DEFAULT_SEED),
    runId: readArg('--run-id') ?? defaultRunId(),
    concurrency: positiveInteger(readArg('--concurrency'), 4, '--concurrency'),
    maxDocumentsPerSource: positiveInteger(
      readArg('--max-documents-per-source'),
      12,
      '--max-documents-per-source',
    ),
    maxBytes: positiveInteger(readArg('--max-mb'), 25, '--max-mb') * 1024 * 1024,
    documentBudgetMs:
      positiveInteger(readArg('--document-budget-seconds'), 180, '--document-budget-seconds') *
      1000,
    sourceIds: readArg('--source-ids')
      ? new Set(
          readArg('--source-ids')!
            .split(',')
            .map((value) => value.trim())
            .filter(Boolean),
        )
      : null,
    dryRun: process.argv.includes('--dry-run'),
  }
}

function loadSeeds(path: string): SeedRow[] {
  const parsed = Papa.parse<SeedRow>(readFileSync(path, 'utf8').trim(), {
    header: true,
    skipEmptyLines: true,
  })
  const parseErrors = parsed.errors.filter((error) => error.code !== 'TooFewFields')
  if (parseErrors.length) throw new Error(parseErrors.map((e) => e.message).join('; '))
  const ids = new Set<string>()
  for (const [index, row] of parsed.data.entries()) {
    if (!row.source_id || !row.institution_id || !row.name_en || !row.canonical_url) {
      throw new Error(`seed row ${index + 2} is missing a required field`)
    }
    if (ids.has(row.source_id)) throw new Error(`duplicate source_id: ${row.source_id}`)
    ids.add(row.source_id)
    const url = new URL(row.canonical_url)
    if (!/^https?:$/.test(url.protocol))
      throw new Error(`unsupported URL: ${row.canonical_url}`)
    for (const candidate of [row.fallback_url, row.current_artifact_url]) {
      if (!candidate) continue
      const candidateUrl = new URL(candidate)
      if (!/^https?:$/.test(candidateUrl.protocol))
        throw new Error(`unsupported URL for ${row.source_id}: ${candidate}`)
    }
    if (!['cds', 'facts'].includes(row.dataset_kind)) {
      throw new Error(`unsupported dataset_kind for ${row.source_id}: ${row.dataset_kind}`)
    }
  }
  return parsed.data
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms))
}

async function readLimited(response: Response, maxBytes: number): Promise<Buffer> {
  if (!response.body) return Buffer.alloc(0)
  const declared = Number(response.headers.get('content-length'))
  if (Number.isFinite(declared) && declared > maxBytes) {
    await response.body.cancel()
    throw new Error(`too_large:${declared}`)
  }

  const reader = response.body.getReader()
  const chunks: Buffer[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > maxBytes) {
      await reader.cancel()
      throw new Error(`too_large:${total}`)
    }
    chunks.push(Buffer.from(value))
  }
  return Buffer.concat(chunks)
}

function safeStem(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

async function fetchArtifact(params: {
  sourceId: string
  artifactKind: 'index_page' | 'document'
  url: string
  artifactsDir: string
  maxBytes: number
  ordinal: number
}): Promise<{ attempt: ArtifactAttempt; body: Buffer | null }> {
  const fetchedAt = new Date().toISOString()
  let lastError: unknown

  for (let tryNumber = 1; tryNumber <= 2; tryNumber += 1) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 30_000)
    try {
      const response = await fetch(params.url, {
        redirect: 'follow',
        headers: {
          'User-Agent': USER_AGENT,
          Accept:
            'text/html,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv;q=0.9,*/*;q=0.5',
        },
        signal: controller.signal,
      })

      if (!response.ok) {
        if (tryNumber < 2 && (response.status === 429 || response.status >= 500)) {
          await response.body?.cancel()
          await sleep(750 * tryNumber)
          continue
        }
        return {
          attempt: {
            artifactKind: params.artifactKind,
            requestedUrl: params.url,
            finalUrl: response.url || params.url,
            status: 'http_error',
            httpStatus: response.status,
            mimeType: response.headers.get('content-type')?.split(';')[0] ?? null,
            byteSize: null,
            sha256: null,
            localPath: null,
            etag: response.headers.get('etag'),
            lastModified: response.headers.get('last-modified'),
            fetchedAt,
            errorDetail: `HTTP ${response.status}`,
          },
          body: null,
        }
      }

      const body = await readLimited(response, params.maxBytes)
      const mimeType =
        response.headers.get('content-type')?.split(';')[0]?.trim() ||
        'application/octet-stream'
      const sha256 = createHash('sha256').update(body).digest('hex')
      const extension = extensionFor(mimeType, response.url || params.url)
      const filename = `${safeStem(params.sourceId)}--${params.artifactKind === 'index_page' ? 'index' : String(params.ordinal).padStart(2, '0')}--${sha256.slice(0, 12)}.${extension}`
      const absolutePath = resolve(params.artifactsDir, filename)
      writeFileSync(absolutePath, body)

      return {
        attempt: {
          artifactKind: params.artifactKind,
          requestedUrl: params.url,
          finalUrl: response.url || params.url,
          status: 'fetched',
          httpStatus: response.status,
          mimeType,
          byteSize: body.byteLength,
          sha256,
          localPath: absolutePath.slice(ROOT.length + 1),
          etag: response.headers.get('etag'),
          lastModified: response.headers.get('last-modified'),
          fetchedAt,
          errorDetail: null,
        },
        body,
      }
    } catch (error) {
      lastError = error
      const message = error instanceof Error ? error.message : String(error)
      if (message.startsWith('too_large:')) {
        return {
          attempt: {
            artifactKind: params.artifactKind,
            requestedUrl: params.url,
            finalUrl: null,
            status: 'too_large',
            httpStatus: null,
            mimeType: null,
            byteSize: Number(message.split(':')[1]) || null,
            sha256: null,
            localPath: null,
            etag: null,
            lastModified: null,
            fetchedAt,
            errorDetail: `exceeded ${params.maxBytes} byte limit`,
          },
          body: null,
        }
      }
      if (tryNumber < 2) {
        await sleep(750 * tryNumber)
        continue
      }
    } finally {
      clearTimeout(timer)
    }
  }

  const message = lastError instanceof Error ? lastError.message : String(lastError)
  return {
    attempt: {
      artifactKind: params.artifactKind,
      requestedUrl: params.url,
      finalUrl: null,
      status: message.toLowerCase().includes('abort') ? 'timeout' : 'network_error',
      httpStatus: null,
      mimeType: null,
      byteSize: null,
      sha256: null,
      localPath: null,
      etag: null,
      lastModified: null,
      fetchedAt,
      errorDetail: message.slice(0, 500),
    },
    body: null,
  }
}

async function crawlSource(
  seed: SeedRow,
  artifactsDir: string,
  options: Options,
): Promise<SourceResult> {
  const rootResult = await fetchArtifact({
    sourceId: seed.source_id,
    artifactKind: 'index_page',
    url: seed.canonical_url,
    artifactsDir,
    maxBytes: options.maxBytes,
    ordinal: 0,
  })
  const rootBody = rootResult.body
  const isHtml = rootResult.attempt.mimeType?.includes('html') && rootBody != null
  const discoveredLinks = isHtml
    ? extractRelevantLinks(
        rootBody.toString('utf8'),
        rootResult.attempt.finalUrl ?? seed.canonical_url,
      )
    : []
  const documents: ArtifactAttempt[] = []

  if (seed.current_artifact_url) {
    const currentArtifact = await fetchArtifact({
      sourceId: seed.source_id,
      artifactKind: 'document',
      url: seed.current_artifact_url,
      artifactsDir,
      maxBytes: options.maxBytes,
      ordinal: 0,
    })
    documents.push(currentArtifact.attempt)
  }

  if (
    rootResult.attempt.status !== 'fetched' &&
    seed.fallback_url &&
    seed.fallback_url !== seed.current_artifact_url &&
    !documents.some((attempt) => attempt.status === 'fetched')
  ) {
    const fallback = await fetchArtifact({
      sourceId: seed.source_id,
      artifactKind: 'document',
      url: seed.fallback_url,
      artifactsDir,
      maxBytes: options.maxBytes,
      ordinal: 0,
    })
    documents.push(fallback.attempt)
  }
  const documentLinks = discoveredLinks
    .filter((link) => link.kind === 'document')
    .filter(
      (link) =>
        link.url !== seed.current_artifact_url && link.url !== seed.fallback_url,
    )
    .slice(0, options.maxDocumentsPerSource)

  const documentDeadline = Date.now() + options.documentBudgetMs
  for (const [index, link] of documentLinks.entries()) {
    if (Date.now() >= documentDeadline) break
    if (index > 0) await sleep(200)
    const result = await fetchArtifact({
      sourceId: seed.source_id,
      artifactKind: 'document',
      url: link.url,
      artifactsDir,
      maxBytes: options.maxBytes,
      ordinal: index + 1,
    })
    documents.push(result.attempt)
  }

  return { seed, root: rootResult.attempt, discoveredLinks, documents }
}

async function main() {
  const options = parseOptions()
  const allSeeds = loadSeeds(options.seedFile)
  const seeds = options.sourceIds
    ? allSeeds.filter((seed) => options.sourceIds?.has(seed.source_id))
    : allSeeds
  if (options.sourceIds) {
    const missing = [...options.sourceIds].filter(
      (sourceId) => !allSeeds.some((seed) => seed.source_id === sourceId),
    )
    if (missing.length) throw new Error(`unknown source IDs: ${missing.join(', ')}`)
  }
  if (seeds.length === 0) throw new Error('no source seeds selected')
  if (options.dryRun) {
    console.log(`Validated ${seeds.length} official source seeds from ${options.seedFile}`)
    return
  }

  const runDir = resolve(ROOT, '.data/runs', options.runId)
  const artifactsDir = resolve(runDir, 'artifacts')
  mkdirSync(artifactsDir, { recursive: true })
  const startedAt = new Date().toISOString()
  const queue = [...seeds]
  const sources: SourceResult[] = []

  await Promise.all(
    Array.from({ length: Math.min(options.concurrency, seeds.length) }, async () => {
      for (;;) {
        const seed = queue.shift()
        if (!seed) return
        const result = await crawlSource(seed, artifactsDir, options)
        sources.push(result)
        const documents = result.documents.filter((item) => item.status === 'fetched').length
        console.log(
          `${result.root.status === 'fetched' ? '✓' : '✗'} ${seed.source_id}: root=${result.root.status}, documents=${documents}`,
        )
      }
    }),
  )

  sources.sort((a, b) => a.seed.source_id.localeCompare(b.seed.source_id))
  const fetchedSourceCount = sources.filter(
    (item) =>
      item.root.status === 'fetched' ||
      item.documents.some((document) => document.status === 'fetched'),
  ).length
  const artifactCount = sources.reduce(
    (sum, item) =>
      sum +
      Number(item.root.status === 'fetched') +
      item.documents.filter((doc) => doc.status === 'fetched').length,
    0,
  )
  const failedSourceCount = seeds.length - fetchedSourceCount
  const status =
    fetchedSourceCount === 0 ? 'failed' : failedSourceCount === 0 ? 'completed' : 'partial'
  const manifest: CrawlManifest = {
    schemaVersion: 1,
    runId: options.runId,
    toolVersion: 'official-source-crawler/1',
    seedFile: options.seedFile.slice(ROOT.length + 1),
    startedAt,
    finishedAt: new Date().toISOString(),
    status,
    summary: {
      seedCount: seeds.length,
      fetchedSourceCount,
      failedSourceCount,
      artifactCount,
      discoveredLinkCount: sources.reduce((sum, item) => sum + item.discoveredLinks.length, 0),
    },
    sources,
  }
  const manifestPath = resolve(runDir, 'manifest.json')
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
  console.log(`Manifest: ${manifestPath}`)
  console.log(JSON.stringify(manifest.summary))
  if (status === 'failed') process.exitCode = 1
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
