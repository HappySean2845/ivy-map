export interface DiscoveredLink {
  url: string
  text: string
  kind: 'document' | 'related_page'
  editionLabel: string | null
}

const DOCUMENT_EXTENSION = /\.(pdf|xlsx?|csv|docx?|zip)(?:$|[?#])/i
const RELEVANT_TEXT =
  /common[\s_-]*data[\s_-]*set|\bcds\b|facts?[\s&_-]*(?:and|&)?[\s_-]*figures?|student[\s_-]*numbers?|annual[\s_-]*(?:report|review)|institutional[\s_-]*(?:data|research)/i

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
}

function cleanText(value: string): string {
  return decodeHtml(
    value
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
  )
}

export function inferEditionLabel(value: string): string | null {
  const normalized = decodeHtml(value).replace(/[–—]/g, '-')
  const range = normalized.match(/\b(20\d{2})\s*[-/]\s*(20\d{2}|\d{2})\b/)
  if (range) {
    const end = range[2].length === 2 ? `${range[1].slice(0, 2)}${range[2]}` : range[2]
    return `${range[1]}-${end}`
  }
  const compact = normalized.match(/\b(20\d{2})\s*[-/]\s*(\d{2})\b/)
  if (compact) return `${compact[1]}-${compact[1].slice(0, 2)}${compact[2]}`
  const year = normalized.match(/\b(20\d{2})\b/)
  return year?.[1] ?? null
}

export function extractRelevantLinks(html: string, baseUrl: string): DiscoveredLink[] {
  const seen = new Set<string>()
  const links: DiscoveredLink[] = []
  const pattern =
    /<a\b[^>]*\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))[^>]*>([\s\S]*?)<\/a>/gi

  for (const match of html.matchAll(pattern)) {
    const rawHref = decodeHtml(match[1] ?? match[2] ?? match[3] ?? '').trim()
    const text = cleanText(match[4] ?? '')
    if (!rawHref || /^(?:#|javascript:|mailto:|tel:)/i.test(rawHref)) continue

    let url: URL
    try {
      url = new URL(rawHref, baseUrl)
    } catch {
      continue
    }
    if (!/^https?:$/.test(url.protocol)) continue
    url.hash = ''
    const normalizedUrl = url.toString()
    const document = DOCUMENT_EXTENSION.test(normalizedUrl)
    if (!document && !RELEVANT_TEXT.test(`${text} ${normalizedUrl}`)) continue
    if (seen.has(normalizedUrl)) continue
    seen.add(normalizedUrl)

    links.push({
      url: normalizedUrl,
      text,
      kind: document ? 'document' : 'related_page',
      editionLabel: inferEditionLabel(`${text} ${normalizedUrl}`),
    })
  }

  return links
}

export function extensionFor(mimeType: string, url: string): string {
  const pathname = new URL(url).pathname
  const fromUrl = pathname.match(/\.([a-z0-9]{1,5})$/i)?.[1]?.toLowerCase()
  if (
    fromUrl &&
    ['pdf', 'xls', 'xlsx', 'csv', 'doc', 'docx', 'zip', 'html', 'htm'].includes(fromUrl)
  ) {
    return fromUrl === 'htm' ? 'html' : fromUrl
  }

  const mime = mimeType.toLowerCase()
  if (mime.includes('pdf')) return 'pdf'
  if (mime.includes('spreadsheetml')) return 'xlsx'
  if (mime.includes('ms-excel')) return 'xls'
  if (mime.includes('csv')) return 'csv'
  if (mime.includes('wordprocessingml')) return 'docx'
  if (mime.includes('msword')) return 'doc'
  if (mime.includes('zip')) return 'zip'
  if (mime.includes('html')) return 'html'
  if (mime.includes('json')) return 'json'
  return 'bin'
}
