import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, extname, resolve } from 'node:path'
import { promisify } from 'node:util'

type SourceClass = 'official' | 'wikimedia_commons'
type AssetKind = 'crest' | 'mark' | 'wordmark'

interface LogoSource {
  universityId: string
  sourceClass: SourceClass
  sourcePage: string
  downloadUrl: string
  extension: '.svg' | '.png'
  assetKind: AssetKind
  displayBackground?: `#${string}`
}

const ROOT = resolve(import.meta.dirname, '../..')
const OUTPUT_DIR = resolve(ROOT, 'public/university-logos')
const ORIGINAL_DIR = resolve(ROOT, '.data/university-logos/originals')
const MANIFEST_PATH = resolve(ROOT, 'data/university-logo-sources.json')
const PROFILE_PATH = resolve(ROOT, 'data/raw/university-profiles.json')
const USER_AGENT =
  'Mozilla/5.0 (compatible; IVYMapLogoResearch/1.0; +https://github.com/HappySean2845/ivy-map)'
const execFileAsync = promisify(execFile)

function commons(universityId: string, filename: string, assetKind: AssetKind): LogoSource {
  const encodedFile = encodeURIComponent(filename)
  return {
    universityId,
    sourceClass: 'wikimedia_commons',
    sourcePage: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(filename.replaceAll(' ', '_'))}`,
    downloadUrl: `https://commons.wikimedia.org/wiki/Special:Redirect/file/${encodedFile}`,
    extension: extname(filename).toLowerCase() as '.svg' | '.png',
    assetKind,
  }
}

const SOURCES: LogoSource[] = [
  commons('harvard', 'Harvard University coat of arms.svg', 'crest'),
  commons('yale', 'Yale University Shield 1.svg', 'crest'),
  commons('princeton', 'Princeton seal.svg', 'crest'),
  commons('columbia', 'Coat of Arms of Columbia University.svg', 'crest'),
  commons('brown', 'Brown Coat of Arms.svg', 'crest'),
  commons('dartmouth', 'Dartmouth College logo.svg', 'wordmark'),
  commons('upenn', 'Shield of the University of Pennsylvania.svg', 'crest'),
  commons('cornell', 'Cornell University seal.svg', 'crest'),
  commons('mit', 'MIT 2023 red logo.svg', 'mark'),
  commons('stanford', 'Seal of Leland Stanford Junior University.svg', 'crest'),
  commons('caltech', 'Caltech Logo.svg', 'wordmark'),
  commons('uchicago', 'University of Chicago wordmark.svg', 'wordmark'),
  commons('duke', 'Duke University logo.svg', 'wordmark'),
  commons('northwestern', 'Northwestern University seal.svg', 'crest'),
  commons('jhu', 'Johns Hopkins University logo.png', 'wordmark'),
  commons('nyu', 'Nyu short color.svg', 'wordmark'),
  commons('berkeley', 'Seal of University of California, Berkeley.svg', 'crest'),
  commons('ucla', 'The University of California UCLA.svg', 'mark'),
  commons('cmu', 'Carnegie Mellon University wordmark.svg', 'wordmark'),
  commons('umich', 'University of Michigan logo.svg', 'wordmark'),
  commons('uw', 'University of Washington Block W logo RGB brand colors.SVG', 'mark'),
  commons('washu', 'Washu textlogo.png', 'wordmark'),
  commons('oxford', 'Arms of University of Oxford.svg', 'crest'),
  commons('cambridge', 'Cambridge University Crest - flat.png', 'crest'),
  commons('imperial', 'Shield of Imperial College London.svg', 'crest'),
  commons('lse', 'London School of Economics Coat of Arms.svg', 'crest'),
  commons('ucl', 'UCL Crest.svg', 'crest'),
  {
    universityId: 'hku',
    sourceClass: 'official',
    sourcePage: 'https://www.hku.hk/',
    downloadUrl: 'https://www.hku.hk/assets/img/hku-115.svg?t=1760950144',
    extension: '.svg',
    assetKind: 'wordmark',
  },
  {
    universityId: 'hkust',
    sourceClass: 'official',
    sourcePage: 'https://www.hkust.edu.hk/',
    downloadUrl: 'https://www.hkust.edu.hk/sites/default/files/2024-03/HKUST_logo_1.svg',
    extension: '.svg',
    assetKind: 'mark',
  },
  {
    universityId: 'cuhk',
    sourceClass: 'official',
    sourcePage: 'https://www.cuhk.edu.hk/english/index.html',
    downloadUrl: 'https://www.cuhk.edu.hk/english/images/cuhk_logo_2x.png?20221027',
    extension: '.png',
    assetKind: 'wordmark',
  },
  {
    universityId: 'toronto',
    sourceClass: 'official',
    sourcePage: 'https://www.utoronto.ca/',
    downloadUrl: 'https://www.utoronto.ca/themes/custom/bootstrap_uoft/logo.svg',
    extension: '.svg',
    assetKind: 'wordmark',
    displayBackground: '#1e3765',
  },
  commons('utokyo', 'University of Tokyo logo (2024).svg', 'wordmark'),
]

function sha256(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex')
}

function pngDimensions(buffer: Buffer): { width: number; height: number } {
  const signature = buffer.subarray(0, 8).toString('hex')
  if (signature !== '89504e470d0a1a0a' || buffer.length < 24) {
    throw new Error('invalid PNG signature')
  }
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) }
}

function svgDimensions(buffer: Buffer): { width: number | null; height: number | null } {
  const text = buffer.toString('utf8')
  if (!/<svg\b/i.test(text)) throw new Error('missing SVG root')
  if (/<script\b|<foreignObject\b|\bon\w+\s*=|javascript:/i.test(text)) {
    throw new Error('SVG contains active content')
  }
  const openingTag = text.match(/<svg\b[^>]*>/i)?.[0] ?? ''
  const viewBox = openingTag
    .match(/\bviewBox=["']\s*[-\d.]+[ ,]+[-\d.]+[ ,]+([\d.]+)[ ,]+([\d.]+)\s*["']/i)
    ?.slice(1, 3)
    .map(Number)
  const width = Number(openingTag.match(/\bwidth=["']([\d.]+)/i)?.[1]) || viewBox?.[0] || null
  const height = Number(openingTag.match(/\bheight=["']([\d.]+)/i)?.[1]) || viewBox?.[1] || null
  return { width, height }
}

async function download(source: LogoSource) {
  const result = (await execFileAsync(
    'curl',
    [
      '-sS',
      '-L',
      '--fail',
      '--max-time',
      '60',
      '--retry',
      '2',
      '--retry-delay',
      '1',
      '--retry-all-errors',
      '--user-agent',
      USER_AGENT,
      '--referer',
      source.sourcePage,
      '--header',
      'Accept: image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      source.downloadUrl,
    ],
    { encoding: 'buffer', maxBuffer: 2_100_000 },
  )) as unknown as { stdout: Buffer }
  const buffer = Buffer.from(result.stdout)
  if (buffer.length === 0 || buffer.length > 2_000_000) {
    throw new Error(`${source.universityId}: invalid asset size ${buffer.length}`)
  }

  const originalDimensions =
    source.extension === '.png' ? pngDimensions(buffer) : svgDimensions(buffer)
  const originalMimeType = source.extension === '.png' ? 'image/png' : 'image/svg+xml'
  const originalPath = resolve(ORIGINAL_DIR, `${source.universityId}${source.extension}`)
  mkdirSync(dirname(originalPath), { recursive: true })
  writeFileSync(originalPath, buffer)

  const publicPath = `/university-logos/${source.universityId}.png`
  const outputPath = resolve(ROOT, `public${publicPath}`)
  mkdirSync(dirname(outputPath), { recursive: true })
  let rasterInputPath = originalPath
  if (source.displayBackground) {
    if (
      source.extension !== '.svg' ||
      !/^#[0-9a-f]{6}$/i.test(source.displayBackground) ||
      originalDimensions.width === null ||
      originalDimensions.height === null
    ) {
      throw new Error(`${source.universityId}: invalid display background`)
    }
    rasterInputPath = resolve(ORIGINAL_DIR, `${source.universityId}.display.svg`)
    const compositedSvg = buffer
      .toString('utf8')
      .replace(
        /(<svg\b[^>]*>)/i,
        `$1\n<rect x="0" y="0" width="${originalDimensions.width}" height="${originalDimensions.height}" fill="${source.displayBackground}"/>`,
      )
    writeFileSync(rasterInputPath, compositedSvg)
  }
  try {
    await execFileAsync('sips', [
      '-s',
      'format',
      'png',
      '-Z',
      '192',
      rasterInputPath,
      '--out',
      outputPath,
    ])
  } finally {
    if (rasterInputPath !== originalPath) rmSync(rasterInputPath, { force: true })
  }
  const displayBuffer = readFileSync(outputPath)
  const displayDimensions = pngDimensions(displayBuffer)
  if (
    displayBuffer.length > 500_000 ||
    displayDimensions.width > 192 ||
    displayDimensions.height > 192
  ) {
    throw new Error(`${source.universityId}: invalid display derivative`)
  }
  if (source.extension !== '.png') {
    rmSync(resolve(OUTPUT_DIR, `${source.universityId}${source.extension}`), { force: true })
  }

  return {
    universityId: source.universityId,
    path: publicPath,
    sourceClass: source.sourceClass,
    assetKind: source.assetKind,
    sourcePage: source.sourcePage,
    requestedAssetUrl: source.downloadUrl,
    resolvedAssetUrl: source.downloadUrl,
    original: {
      mimeType: originalMimeType,
      byteSize: buffer.length,
      width: originalDimensions.width,
      height: originalDimensions.height,
      sha256: sha256(buffer),
    },
    display: {
      mimeType: 'image/png',
      background: source.displayBackground ?? null,
      byteSize: displayBuffer.length,
      width: displayDimensions.width,
      height: displayDimensions.height,
      sha256: sha256(displayBuffer),
    },
  }
}

async function mapWithLimit<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  const output = new Array<R>(items.length)
  let next = 0
  async function worker() {
    while (next < items.length) {
      const index = next++
      output[index] = await mapper(items[index])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return output
}

function updateProfiles(logos: Awaited<ReturnType<typeof download>>[]) {
  const logoPathById = new Map(logos.map((logo) => [logo.universityId, logo.path]))
  let text = readFileSync(PROFILE_PATH, 'utf8')
  for (const source of SOURCES) {
    const path = logoPathById.get(source.universityId)
    if (!path) throw new Error(`missing downloaded logo for ${source.universityId}`)
    const expression = new RegExp(
      `("universityId": "${source.universityId}"[\\s\\S]{0,300}?"logoPath": )(?:null|"[^"]+")`,
    )
    const matches = text.match(expression)
    if (!matches) throw new Error(`profile logoPath not found for ${source.universityId}`)
    text = text.replace(expression, `$1"${path}"`)
  }
  writeFileSync(PROFILE_PATH, text)
}

async function main() {
  if (new Set(SOURCES.map((source) => source.universityId)).size !== 32) {
    throw new Error('expected 32 unique university logo sources')
  }
  const logos = await mapWithLimit(SOURCES, 3, download)
  updateProfiles(logos)
  writeFileSync(
    MANIFEST_PATH,
    `${JSON.stringify({ schemaVersion: 1, publishedAt: '2026-08-07', logos }, null, 2)}\n`,
  )
  console.log(
    `Downloaded ${logos.length} university logos (${logos.filter((item) => item.sourceClass === 'official').length} official, ${logos.filter((item) => item.sourceClass === 'wikimedia_commons').length} Commons)`,
  )
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
