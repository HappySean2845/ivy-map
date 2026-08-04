import { createHash } from 'node:crypto'
import { copyFileSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { basename, resolve } from 'node:path'
import Papa from 'papaparse'

type CurriculumCode =
  | 'AP'
  | 'IB'
  | 'ALEVEL'
  | 'BC'
  | 'OSSD'
  | 'VCE'
  | 'DSE'
  | 'EJU'
  | 'GERMAN'
  | 'IFY'
  | 'SABIS'
  | 'ALBERTA'
  | 'SACE'
  | 'GAC'
  | 'DOMESTIC'
  | 'OTHER'

type AttributionStatus = 'confirmed' | 'inferred' | 'possible' | 'excluded'
type AttributionBasis =
  | 'source_named'
  | 'single_track'
  | 'program_report'
  | 'student_profile'
  | 'destination_pattern'
  | 'temporal_elimination'
  | 'unknown'

interface CatalogSchool {
  id: string
  name_cn: string
  name_en: string
}

interface CatalogUniversity {
  id: string
  name_cn: string
  name_en: string
  country: string
}

interface SchoolBlock {
  title: string
  displayName: string
  region: string
  headingLine: number
  lines: Array<{ number: number; text: string }>
}

interface CleanSchool {
  id: string
  nameLocal: string
  nameEn: string
  region: string
  matchedExisting: boolean
  headings: string[]
}

interface ProgramRecord {
  schoolId: string
  curriculumCode: CurriculumCode
  role: 'primary' | 'secondary' | 'elective' | 'unknown'
  validFromYear: number | null
  firstGraduatingYear: number | null
  validToYear: number | null
  isSingleTrack: boolean
  sourceLine: number
  sourceExcerpt: string
  programHash: string
}

interface AttributionRecord {
  curriculumCode: CurriculumCode
  status: AttributionStatus
  basis: AttributionBasis
  allocationKind: 'full' | 'partial' | 'unallocated'
  allocatedCount: number | null
  exclusionRisk: boolean
  attributionHash: string
}

interface ObservationRecord {
  schoolId: string
  universityId: string
  year: number
  admissionRound:
    | 'ED'
    | 'ED1'
    | 'ED2'
    | 'EA'
    | 'REA'
    | 'RD'
    | 'rolling'
    | 'early_combined'
    | 'combined'
    | 'unknown'
  track: 'AP' | 'IB' | 'ALEVEL' | null
  countKind: 'admits' | 'offers' | 'reported' | 'estimated' | 'enrolled' | 'interviews'
  countValue: number | null
  countMin: number | null
  countMax: number | null
  sourceLine: number
  sourceExcerpt: string
  attributionStatus: AttributionStatus
  reviewStatus: 'extracted' | 'reviewed'
  observationHash: string
  attributions: AttributionRecord[]
}

interface CleanResult {
  schemaVersion: 1
  source: {
    filename: string
    sha256: string
    byteSize: number
    capturedAt: string
  }
  schools: CleanSchool[]
  programs: ProgramRecord[]
  observations: ObservationRecord[]
  report: {
    detectedSchoolBlocks: number
    uniqueSchools: number
    matchedExistingSchools: number
    newSchools: number
    programRows: number
    observationRows: number
    attributionRows: number
    observationsByStatus: Record<AttributionStatus, number>
    observationsByTrack: Record<string, number>
    skipped: Record<string, number>
    duplicateClaimsRemoved: number
    schoolHeadingMap: Array<{
      heading: string
      institutionId: string
      matchedExisting: boolean
    }>
  }
}

const ELIGIBLE = new Set<CurriculumCode>(['AP', 'IB', 'ALEVEL'])

const UNIVERSITY_ALIASES: Record<string, string[]> = {
  harvard: ['Harvard', '哈佛大学', '哈佛'],
  yale: ['Yale', '耶鲁大学', '耶鲁'],
  princeton: ['Princeton', '普林斯顿大学', '普林斯顿'],
  columbia: ['Columbia', '哥伦比亚大学', '哥伦比亚', '哥大'],
  brown: ['Brown', '布朗大学', '布朗'],
  dartmouth: ['Dartmouth', '达特茅斯学院', '达特茅斯'],
  upenn: ['University of Pennsylvania', 'UPenn', '宾夕法尼亚大学', '宾夕法尼亚', '宾大'],
  cornell: ['Cornell', '康奈尔大学', '康奈尔'],
  mit: ['MIT', '麻省理工学院', '麻省理工'],
  stanford: ['Stanford', '斯坦福大学', '斯坦福'],
  caltech: ['Caltech', '加州理工学院', '加州理工'],
  uchicago: ['UChicago', 'University of Chicago', '芝加哥大学', '芝大'],
  duke: ['Duke', '杜克大学', '杜克'],
  northwestern: ['Northwestern', '西北大学', '西北'],
  jhu: ['Johns Hopkins', 'JHU', '约翰霍普金斯大学', '约翰霍普金斯'],
  nyu: ['New York University', 'NYU', '纽约大学'],
  berkeley: ['UC Berkeley', 'UCB', '加州大学伯克利分校', '加州大学伯克利', '伯克利'],
  ucla: ['UCLA', '加州大学洛杉矶分校', '加州大学洛杉矶'],
  cmu: ['Carnegie Mellon', 'CMU', '卡内基梅隆大学', '卡内基梅隆'],
  umich: ['University of Michigan', 'UMich', '密歇根大学安娜堡分校', '密歇根安娜堡'],
  washu: [
    'Washington University in St. Louis',
    'WashU',
    '圣路易斯华盛顿大学',
    '圣路易斯华盛顿',
  ],
  uw: ['University of Washington', '华盛顿大学'],
  oxford: ['University of Oxford', 'Oxford', '牛津大学', '牛津'],
  cambridge: ['University of Cambridge', 'Cambridge', '剑桥大学', '剑桥'],
  imperial: ['Imperial College London', 'Imperial', '帝国理工学院', '帝国理工', 'IC'],
  lse: ['London School of Economics', 'LSE', '伦敦政治经济学院', '伦敦政经'],
  ucl: ['University College London', 'UCL', '伦敦大学学院'],
  hku: ['University of Hong Kong', 'HKU', '香港大学', '港大'],
  hkust: ['Hong Kong University of Science and Technology', 'HKUST', '香港科技大学', '港科大'],
  cuhk: ['Chinese University of Hong Kong', 'CUHK', '香港中文大学', '港中文'],
  toronto: ['University of Toronto', 'Toronto', '多伦多大学', '多伦多'],
  utokyo: ['University of Tokyo', 'Tokyo University', '东京大学'],
}

const SCHOOL_ID_RULES: Array<[RegExp, string]> = [
  [/上中国际部|上海中学国际部|SHSID/i, 'shsid'],
  [/上海市世界外国语中学|^世外(?:（|\s|$)/, 'wfls'],
  [/包玉刚/, 'ykpao'],
  [/平和/, 'pinghe'],
  [/星河湾/, 'xinghewan'],
  [/复旦大学附属中学国际部|复旦附中国际部/, 'fudanfz'],
  [/华东师范大学第二附属中学国际部|华二附中国际部/, 'hsefz'],
  [/七宝德怀特/, 'qibaodwight'],
  [/(?<!西南)位育中学国际部|上海市民办位育/, 'weiyu'],
  [/协和古北/, 'concordia'],
  [/领科(?:教育)?上海/, 'ulink'],
  [/光华剑桥/, 'guanghua'],
  [/上海惠灵顿/, 'wellington-sh'],
  [/市西中学国际部/, 'shixi'],
  [/北师大实验国际部|北京师范大学附属实验中学国际部/, 'bnusz'],
  [/人大附ICC|中国人民大学附属中学国际部|人大附中ICC/, 'rdfz'],
  [/十一学校国际部/, 'bjshiyi'],
  [/四中国际校区|北京市第四中学国际校区/, 'bhsf'],
  [/北京鼎石|Keystone Academy/i, 'keystone'],
  [/北京乐成国际学校|BCIS/i, 'bcis'],
  [/北京世青国际学校|BWYA/i, 'bwya'],
  [/北京王府学校/, 'wangfu'],
  [/北京爱迪学校|北京爱迪国际学校/, 'aidi'],
  [/深圳国际交流书院|深国交/, 'scie'],
  [/深圳中学国际部|深中(?:）|·|$)/, 'szzx'],
  [/深圳外国语学校国际(?:部|书院)|深外国际书院|SWIS/i, 'szwy'],
  [/深圳贝赛思|蛇口贝赛思/, 'basis-sz'],
  [/万科梅沙/, 'meisha'],
  [/深圳.*富源英美|深圳富源英美/, 'fuyuan'],
  [/华南师大附中国际部|华附国际|HFI/i, 'hsfz'],
  [/广东实验中学.*国际|省实\s*AP/, 'gdsyzx'],
  [/广东碧桂园学校|广碧|GCGS/i, 'bgy'],
  [/广州外国语学校本部|广州外国语学校(?:（|$)/, 'gzfls'],
  [/杭州外国语学校剑桥|杭外剑高|杭州外国语学校（本部/, 'hzwy'],
  [/杭州第十四中学国际部|杭十四/, 'hz14'],
  [/南京外国语学校（南外·本部|^南外·IB|南京外国语学校 IBDP 项目/, 'njwy'],
  [/南京市第一中学国际部|南京一中国际部/, 'njyz'],
  [/苏州德威国际高中|Dulwich College Suzhou/i, 'dulwich-sz'],
  [/成都树德中学国际部|树德国际部/, 'shude'],
  [/武汉英中学校|武汉外校英中|武汉外国语学校国际部/, 'whwy'],
  [/(?:金陵中学中美班|金中中美|金陵中学国际部剑桥班|金中剑桥)(?!河西)/, 'hs-jinling-nanjing'],
  [/深大师院国际高中|AISSU/i, 'hs-aissu-shenzhen'],
  [/广东外语外贸大学实验中学国际部|广外\s*AP&AL|广外青藤/, 'hs-gw-qingteng'],
  [/华润小径湾贝赛思|惠州贝赛思|小径湾贝赛思|惠贝/, 'hs-basis-huizhou'],
]

const GENERIC_HEADING =
  /摘要|置信度|Evidence|证据|来源清单|数据天花板|归因规则|课程轨道总表|部门结构总表|逐校归因|本轮产出|三桶归因|关键去重|缺口清单|跨年累计|跨年份累计|收尾报告|版本声明|版本与口径|附一|附二|附三|附四|学部归因依据|实体去重|各校明细|顶部摘要|硬规则|本轮最重要|一、|二、|三、|四、|五、|六、/

const EXPLICIT_SCHOOL_HEADING = /常州外国语附属双语学校|南外仙林分校国际高中/

function arg(name: string): string | null {
  const index = process.argv.indexOf(name)
  return index >= 0 ? (process.argv[index + 1] ?? null) : null
}

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

function sql(value: unknown): string {
  if (value == null) return 'NULL'
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NULL'
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE'
  return `'${String(value).replace(/\0/g, '').replace(/'/g, "''")}'`
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
      a.localeCompare(b),
    )
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(',')}}`
  }
  return JSON.stringify(value)
}

function readCsv<T>(path: string): T[] {
  const parsed = Papa.parse<T>(readFileSync(path, 'utf8').trim(), {
    header: true,
    skipEmptyLines: true,
  })
  if (parsed.errors.length)
    throw new Error(parsed.errors.map((error) => error.message).join('; '))
  return parsed.data
}

function legacyHeadingForId(raw: string): string {
  return raw
    .replace(/^###\s+/, '')
    .replace(/^\d+\.\s*/, '')
    .replace(/`[^`]*`.*$/, '')
    .replace(/\s+→.*$/, '')
    .replace(/\s+—.*$/, '')
    .replace(/[·・]\s+[^（(]*$/, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function trimTopLevelLocation(value: string): string {
  let depth = 0
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index]
    if (character === '（' || character === '(') depth += 1
    if (character === '）' || character === ')') depth = Math.max(0, depth - 1)
    if (depth === 0 && (value.startsWith(' · ', index) || value.startsWith(' ・ ', index))) {
      return value.slice(0, index)
    }
  }
  return value
}

function cleanHeading(raw: string): string {
  const withoutAttribution = raw
    .replace(/^###\s+/, '')
    .replace(/^\d+\.\s*/, '')
    .replace(/`[^`]*`.*$/, '')
    .replace(/[→—].*$/, '')
    .replace(/\s+⭐.*$/, '')
    .replace(/\s+/g, ' ')
    .trim()
  return trimTopLevelLocation(withoutAttribution).trim()
}

function isSchoolHeading(lines: string[], index: number): boolean {
  const line = lines[index]
  if (!line.startsWith('### ')) return false
  const title = line.slice(4).trim()
  if (/^(?:20\d{2}|\d+\.\d+)/.test(title)) return false
  if (GENERIC_HEADING.test(title)) return false
  if (EXPLICIT_SCHOOL_HEADING.test(title)) return true
  if (/^\d+\.\s+/.test(title)) return true
  if (title.includes('`')) return true
  const lookahead = lines.slice(index + 1, index + 8).join('\n')
  return /\*\*(?:课程轨道|部门构成|课程体系|课程部门|部门)\*?\*?[：:]|^\*\*部门\*\*/m.test(
    lookahead,
  )
}

export function extractSchoolBlocks(markdown: string): SchoolBlock[] {
  const lines = markdown.split(/\r?\n/)
  const blocks: SchoolBlock[] = []
  let region = 'unknown'
  let current: SchoolBlock | null = null

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    const regionMatch = line.match(/^## (上海地区|北京地区|广东\/港澳地区|江浙地区|其他省份)$/)
    if (regionMatch) {
      region = regionMatch[1]
      current = null
      continue
    }

    if (isSchoolHeading(lines, index)) {
      const title = line.slice(4).trim()
      current = {
        title,
        displayName: cleanHeading(line),
        region,
        headingLine: index + 1,
        lines: [],
      }
      blocks.push(current)
      continue
    }

    if (/^#{1,3}\s/.test(line) && GENERIC_HEADING.test(line)) {
      current = null
      continue
    }

    if (current) current.lines.push({ number: index + 1, text: line })
  }

  return blocks
}

function schoolIdFor(block: SchoolBlock): string {
  const haystack = `${block.title} ${block.displayName}`
  for (const [pattern, id] of SCHOOL_ID_RULES) {
    if (pattern.test(haystack)) return id
  }
  // IDs from the first import are already foreign keys in production. Keep using the
  // original heading normalization for the hash even when display-name cleanup improves.
  const stableIdName = legacyHeadingForId(`### ${block.title}`)
  const normalized = stableIdName
    .toLocaleLowerCase('zh-CN')
    .replace(/[（(][^）)]*[）)]/g, '')
    .replace(/国际(?:课程|高中|学校|部|中心|书院|校区|教育)/g, '')
    .replace(/学校|中学|学院/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '')
  return `hs-cn-${hash(normalized || stableIdName).slice(0, 12)}`
}

function curriculumCodes(text: string): CurriculumCode[] {
  const definitions: Array<[CurriculumCode, RegExp, RegExp?]> = [
    [
      'AP',
      /(?:\bAP\b|美高\s*\+?\s*AP|中美课程|中美班|自学\s*AP)/gi,
      /无(?:独立)?\s*AP(?:轨|学部|课程|中心)?/i,
    ],
    ['IB', /(?:\bIB(?:DP|-DP)?\b|国际文凭)/gi, /无(?:独立)?\s*IB(?:轨|学部|课程|中心)?/i],
    [
      'ALEVEL',
      /(?:A[ -]?Level|IGCSE|剑桥课程|剑桥班)/gi,
      /无(?:独立)?\s*A[ -]?Level(?:轨|学部|课程|中心)?/i,
    ],
    ['BC', /(?:中加(?:BC)?|\bBC\s*课程)/gi],
    ['OSSD', /\bOSSD\b/gi],
    ['VCE', /\bVCE\b|澳洲\s*VCE/gi],
    ['DSE', /\bHK?DSE\b/gi],
    ['EJU', /\bEJU\b|日本课程|日高|中日班|日本方向/gi],
    ['GERMAN', /德国课程|中德班|德语方向/gi],
    ['IFY', /\bIFY\b|IFY\s*预科/gi],
    ['SABIS', /\bSABIS\b/gi],
    ['ALBERTA', /\bAlberta\b/gi],
    ['SACE', /\bSACE\b/gi],
    ['GAC', /\bGAC\b|GAC\/ACT/gi],
    ['DOMESTIC', /国内普高|普高班|高考|港澳台联考/gi],
  ]
  const found: CurriculumCode[] = []
  for (const [code, positive, negative] of definitions) {
    positive.lastIndex = 0
    if (!positive.test(text)) continue
    if (negative?.test(text)) continue
    found.push(code)
  }
  return found
}

function programText(block: SchoolBlock): { line: number; text: string } {
  const candidate = block.lines
    .slice(0, 14)
    .find(({ text }) => /课程轨道|部门构成|课程体系|课程部门|\*\*部门\*\*/.test(text))
  if (candidate) return { line: candidate.number, text: candidate.text }
  return { line: block.headingLine, text: block.title }
}

function programRole(text: string, code: CurriculumCode, eligibleCount: number) {
  if (eligibleCount === 1 && ELIGIBLE.has(code)) return 'primary' as const
  const labels: Record<CurriculumCode, RegExp> = {
    AP: /AP|美高|中美/,
    IB: /IB/,
    ALEVEL: /A[ -]?Level|IGCSE|剑桥/,
    BC: /BC|中加/,
    OSSD: /OSSD/,
    VCE: /VCE|澳洲/,
    DSE: /DSE/,
    EJU: /EJU|日本|日高|中日/,
    GERMAN: /德国|中德|德语/,
    IFY: /IFY/,
    SABIS: /SABIS/,
    ALBERTA: /Alberta/,
    SACE: /SACE/,
    GAC: /GAC/,
    DOMESTIC: /普高|高考|联考/,
    OTHER: /其他/,
  }
  const match = labels[code].exec(text)
  if (!match) return 'unknown' as const
  const nearby = text.slice(Math.max(0, match.index - 12), match.index + match[0].length + 16)
  if (/主轨|主体|主线|主力|为主|（主）/.test(nearby)) return 'primary' as const
  if (/辅轨|为辅|补充|选修|小规模/.test(nearby)) return 'secondary' as const
  return 'unknown' as const
}

function extractPrograms(block: SchoolBlock, schoolId: string): ProgramRecord[] {
  const source = programText(block)
  const text = `${block.title}\n${source.text}`
  const codes = curriculumCodes(text)
  const eligibleCount = codes.filter((code) => ELIGIBLE.has(code)).length
  const isSingleTrack = /单轨|唯一(?:课程体系|毕业通道)/.test(text) && eligibleCount === 1
  const years = [...text.matchAll(/(?:20\d{2})/g)].map((match) => Number(match[0]))
  const firstGraduatingMatch = text.match(/(20\d{2})\s*(?:届|首届)/)
  const validFromMatch = text.match(
    /(20\d{2})(?:\s*年|秋)?(?:设立|开设|新设|新增|首次招生|授权)/,
  )

  return codes.map((code) => {
    const logicalKey = canonicalJson({
      schoolId,
      curriculumCode: code,
      sourceLine: source.line,
    })
    return {
      schoolId,
      curriculumCode: code,
      role: programRole(text, code, eligibleCount),
      validFromYear: validFromMatch ? Number(validFromMatch[1]) : null,
      firstGraduatingYear: firstGraduatingMatch ? Number(firstGraduatingMatch[1]) : null,
      validToYear:
        /停办|停止招生|已取消/.test(text) && years.length ? Math.max(...years) : null,
      isSingleTrack,
      sourceLine: source.line,
      sourceExcerpt: source.text.trim().slice(0, 500),
      programHash: hash(logicalKey),
    }
  })
}

interface UniversityOccurrence {
  id: string
  start: number
  end: number
  alias: string
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function universityOccurrences(line: string): UniversityOccurrence[] {
  const matches: UniversityOccurrence[] = []
  for (const [id, aliases] of Object.entries(UNIVERSITY_ALIASES)) {
    for (const alias of aliases) {
      const ascii = /^[\x00-\x7F]+$/.test(alias)
      const expression = ascii
        ? new RegExp(`(?<![A-Za-z])${escapeRegExp(alias)}(?![A-Za-z])`, 'gi')
        : new RegExp(escapeRegExp(alias), 'g')
      for (const match of line.matchAll(expression)) {
        matches.push({
          id,
          start: match.index,
          end: match.index + match[0].length,
          alias: match[0],
        })
      }
    }
  }
  matches.sort((a, b) => a.start - b.start || b.end - b.start - (a.end - a.start))

  const nonOverlapping: UniversityOccurrence[] = []
  for (const match of matches) {
    if (nonOverlapping.some((kept) => match.start < kept.end && match.end > kept.start))
      continue
    nonOverlapping.push(match)
  }

  const collapsed: UniversityOccurrence[] = []
  for (const match of nonOverlapping) {
    const previous = collapsed.at(-1)
    if (
      previous?.id === match.id &&
      /^[\s·・/（）()]*$/.test(line.slice(previous.end, match.start))
    ) {
      previous.end = match.end
      previous.alias = `${previous.alias} ${match.alias}`
      continue
    }
    collapsed.push(match)
  }
  return collapsed
}

function yearForLine(line: string, currentYear: number | null): number | null {
  const normalized = line.replace(/[*_]/g, '').trim()
  const match = normalized.match(
    /^(?:[-|]\s*)?(20(?:20|21|22|23|24|25|26))(?:\s*届)?(?:\b|\s|[|（(:：])/,
  )
  if (match) return Number(match[1])
  return currentYear
}

function admissionRound(text: string): ObservationRecord['admissionRound'] {
  if (/全轮次|RD\s*\d+\s*[+＋]\s*ED|ED\s*\d+\s*[+＋]\s*RD/i.test(text)) return 'combined'
  if (/ED1/i.test(text)) return 'ED1'
  if (/ED2/i.test(text)) return 'ED2'
  if (/REA/i.test(text)) return 'REA'
  if (/\bEA\b/i.test(text)) return 'EA'
  if (/\bRD\b/i.test(text)) return 'RD'
  if (/\bED\b|早申/i.test(text)) return 'ED'
  if (/rolling|滚动/i.test(text)) return 'rolling'
  return 'unknown'
}

function countForSegment(segment: string): {
  value: number | null
  min: number | null
  max: number | null
  estimated: boolean
} | null {
  if (
    /无逐校|数未拆|未点名|非.{0,12}单校|整体口径|均有录取|均有斩获|有斩获|若干|待核/.test(
      segment,
    )
  ) {
    return null
  }
  const roundCounts = [
    ...segment.matchAll(/\b(?:ED1|ED2|ED|RD|EA|REA)\s*[:：]?\s*\*{0,2}(\d{1,3})\b/gi),
  ]
  if (roundCounts.length >= 2) {
    return {
      value: roundCounts.reduce((sum, match) => sum + Number(match[1]), 0),
      min: null,
      max: null,
      estimated: false,
    }
  }

  const cleaned = segment
    .replace(/^\s*(?:\([^)]*(?:ED1|ED2|ED|RD|EA|REA|轮)[^)]*\))?/i, '')
    .replace(/^\s*(?:ED1|ED2|ED|RD|EA|REA)\s*/i, '')
  const match = cleaned.match(
    /^\s*(?:[:：|]|为|×)?\s*\*{0,2}\s*(≈|约|≥|>|不少于)?\s*(\d{1,4})(?:\s*[–—-]\s*(\d{1,4}))?/,
  )
  if (!match) return null
  const first = Number(match[2])
  if (first >= 2020 && first <= 2030) return null
  const second = match[3] ? Number(match[3]) : null
  if (first === 0 && second == null) return null
  if (match[1] === '≥' || match[1] === '>' || match[1] === '不少于') return null
  if (second != null) {
    return {
      value: null,
      min: Math.min(first, second),
      max: Math.max(first, second),
      estimated: true,
    }
  }
  return {
    value: first,
    min: null,
    max: null,
    estimated: match[1] === '≈' || match[1] === '约',
  }
}

function statusFor(text: string): AttributionStatus {
  if (/(?:排除风险|若.{0,12}排除|其他[·・]?排除.{0,12}若)/.test(text)) return 'possible'
  if (/其他[·・]?排除|非AP\/A-Level\/IB|(?:^|[（(])排除(?:[）)]|\s*[✅☑])/.test(text))
    return 'excluded'
  if (text.includes('⚪')) return 'possible'
  if (text.includes('🟡')) return 'inferred'
  if (text.includes('✅')) return 'confirmed'
  return 'possible'
}

function basisFor(
  text: string,
  status: AttributionStatus,
  singleTrack: boolean,
): AttributionBasis {
  if (singleTrack && status === 'confirmed') return 'single_track'
  if (/学子档案|人物志|人物稿|学生|点名.*班/.test(text)) return 'student_profile'
  if (/无毕业生|不可能|可确定非|首次招生|首届/.test(text)) return 'temporal_elimination'
  if (/来源点名|源证|官微.*部门|项目级点名|按部门|分部门|单独发榜/.test(text))
    return 'source_named'
  if (/项目级|学部|课程部|项目/.test(text) && status === 'confirmed') return 'program_report'
  if (status === 'inferred') return 'destination_pattern'
  return 'unknown'
}

function countKind(text: string, estimated: boolean): ObservationRecord['countKind'] {
  if (estimated) return 'estimated'
  if (/面邀|面试邀请/.test(text)) return 'interviews'
  if (/offer|预录取|\d\s*(?:枚|份)/i.test(text)) return 'offers'
  if (/入读|最终去向/.test(text)) return 'enrolled'
  if (/\d\s*(?:人|名)(?!次)/.test(text)) return 'admits'
  return 'reported'
}

function explicitCurricula(text: string): CurriculumCode[] {
  const codes = curriculumCodes(text)
  return codes.filter((code) => {
    const labels: Record<CurriculumCode, RegExp> = {
      AP: /AP|美高|中美/,
      IB: /IB/,
      ALEVEL: /A[ -]?Level|IGCSE|剑桥班|剑桥课程/,
      BC: /BC|中加/,
      OSSD: /OSSD/,
      VCE: /VCE|澳洲/,
      DSE: /DSE/,
      EJU: /EJU|日本|日高|中日/,
      GERMAN: /德国|中德|德语/,
      IFY: /IFY/,
      SABIS: /SABIS/,
      ALBERTA: /Alberta/,
      SACE: /SACE/,
      GAC: /GAC/,
      DOMESTIC: /普高|高考|联考/,
      OTHER: /其他/,
    }
    const match = labels[code].exec(text)
    if (!match) return false
    const before = text.slice(Math.max(0, match.index - 8), match.index)
    return !/无(?:独立)?\s*$|非\s*$/.test(before)
  })
}

function attributionClause(text: string): string {
  const bracketed = [
    ...text.matchAll(/[（(]([^（）()]{0,180}(?:✅|🟡|⚪)[^（）()]{0,180})[）)]/gu),
  ].map((match) => match[1])
  if (bracketed.length) return bracketed.join(' | ')

  const marker = text.search(/✅|🟡|⚪/u)
  if (marker < 0) return text
  const markerText = /^(?:✅|🟡|⚪)/u.exec(text.slice(marker))?.[0] ?? ''
  const leftDelimiter = Math.max(text.lastIndexOf('|', marker), text.lastIndexOf('；', marker))
  const rightDelimiter = text.indexOf('|', marker)
  const beforeMarker = text.slice(leftDelimiter + 1, marker + markerText.length)
  if (explicitCurricula(beforeMarker).length) return beforeMarker
  return text.slice(leftDelimiter + 1, rightDelimiter < 0 ? text.length : rightDelimiter)
}

function allocatedCountFor(text: string, code: CurriculumCode): number | null {
  const labels: Partial<Record<CurriculumCode, string>> = {
    AP: '(?:美高\\s*\\+?\\s*)?AP',
    IB: 'IB(?:DP|-DP)?',
    ALEVEL: 'A[ -]?Level',
  }
  const label = labels[code]
  if (!label) return null
  const before = new RegExp(
    `(\\d{1,3})(?!\\d)\\s*(?:份|枚|人)?\\s*[（(]?\\s*${label}`,
    'i',
  ).exec(text)
  const after = new RegExp(`${label}\\s*[:：]?\\s*(\\d{1,3})(?!\\d)`, 'i').exec(text)
  const value = Number(after?.[1] ?? before?.[1] ?? NaN)
  return Number.isInteger(value) && value > 0 ? value : null
}

function extractObservations(
  block: SchoolBlock,
  schoolId: string,
  programs: ProgramRecord[],
  skipped: Record<string, number>,
): ObservationRecord[] {
  const records: ObservationRecord[] = []
  let currentYear: number | null = null
  const eligiblePrograms = programs.filter((program) => ELIGIBLE.has(program.curriculumCode))
  const excludedPrograms = programs.filter((program) => !ELIGIBLE.has(program.curriculumCode))
  const singleTrack = eligiblePrograms.length === 1 && eligiblePrograms[0].isSingleTrack

  for (const sourceLine of block.lines) {
    const text = sourceLine.text.trim()
    const yearHeading = text
      .replace(/[*#_]/g, '')
      .trim()
      .match(/^(20(?:20|21|22|23|24|25|26))(?:\s*届)?(?:\b|\s|[（(:：])/)
    if (yearHeading) currentYear = Number(yearHeading[1])
    if (!text || text.startsWith('>')) continue
    if (/^\*{0,2}(?:小结|判读|合计|总结)/.test(text)) continue
    if (!/^[-|]/.test(text) && !/^[^#].*(?:20(?:20|21|22|23|24|25|26))/.test(text)) continue
    if (/^(?:[-|]\s*)?\*{0,2}20\d{2}\s*[–—-]\s*20\d{2}/.test(text)) {
      skipped.multi_year_aggregate += 1
      continue
    }

    const year = yearForLine(text, currentYear)
    if (!year) {
      skipped.missing_year += 1
      continue
    }
    const occurrences = universityOccurrences(text)
    if (occurrences.length === 0) continue

    for (let index = 0; index < occurrences.length; index += 1) {
      const occurrence = occurrences[index]
      const next = occurrences[index + 1]
      const segmentEnd = next?.start ?? text.length
      const local = text.slice(occurrence.start, segmentEnd)
      const count = countForSegment(text.slice(occurrence.end, segmentEnd))
      if (!count) {
        skipped.missing_or_non_atomic_count += 1
        continue
      }
      if (
        !Number.isInteger(count.value ?? count.min) ||
        !Number.isInteger(count.value ?? count.max)
      ) {
        skipped.invalid_count += 1
        continue
      }

      const contextual = text.startsWith('|') ? text : local
      const attributionText = attributionClause(contextual)
      let status = statusFor(attributionText)
      if (status === 'possible' && singleTrack && !text.includes('⚪')) status = 'confirmed'

      let codes = explicitCurricula(attributionText)
      if (codes.length === 0) {
        if (singleTrack) codes = [eligiblePrograms[0].curriculumCode]
        else if (status === 'possible')
          codes = eligiblePrograms.map((program) => program.curriculumCode)
      }
      if (status === 'excluded' && codes.length === 0) {
        codes = excludedPrograms.map((program) => program.curriculumCode)
      }
      codes = [...new Set(codes)]
      if (codes.length === 0) {
        skipped.curriculum_backfill_needed += 1
        status = 'possible'
      }

      const basis = basisFor(contextual, status, singleTrack)
      const exclusionRisk = /排除风险|若为中加|可能.*(?:OSSD|DSE|VCE|中加|日本)/.test(
        contextual,
      )
      if (exclusionRisk) {
        const riskCodes = explicitCurricula(contextual).filter((code) => !ELIGIBLE.has(code))
        codes = [...new Set([...codes, ...riskCodes])]
        if (status === 'possible' && !codes.some((code) => ELIGIBLE.has(code))) {
          codes = [
            ...new Set([
              ...eligiblePrograms.map((program) => program.curriculumCode),
              ...codes,
            ]),
          ]
        }
      }
      const allocations = new Map(
        codes.map((code) => [code, allocatedCountFor(contextual, code)] as const),
      )
      const allocatedValues = [...allocations.values()].filter(
        (value): value is number => value != null,
      )
      const hasCompleteAllocation = codes.length > 1 && allocatedValues.length === codes.length
      if (hasCompleteAllocation) {
        count.value = allocatedValues.reduce((sum, value) => sum + value, 0)
        count.min = null
        count.max = null
        count.estimated = false
      }
      const confirmedEligible = codes.filter((code) => ELIGIBLE.has(code))
      const track =
        status === 'confirmed' && confirmedEligible.length === 1
          ? (confirmedEligible[0] as 'AP' | 'IB' | 'ALEVEL')
          : null
      const round = admissionRound(local)
      const kind = countKind(local, count.estimated)
      const observationKey = canonicalJson({
        source: 'course-attribution-2023-2026',
        schoolId,
        universityId: occurrence.id,
        year,
        round,
        track,
        kind,
        countValue: count.value,
        countMin: count.min,
        countMax: count.max,
        line: sourceLine.number,
      })
      const observationHash = hash(observationKey)
      const attributions = codes.map((curriculumCode) => {
        const attributionStatus =
          exclusionRisk && !ELIGIBLE.has(curriculumCode) ? 'possible' : status
        return {
          curriculumCode,
          status: attributionStatus,
          basis: attributionStatus === status ? basis : ('unknown' as const),
          allocationKind:
            codes.length === 1
              ? ('full' as const)
              : hasCompleteAllocation
                ? ('partial' as const)
                : ('unallocated' as const),
          allocatedCount: hasCompleteAllocation
            ? (allocations.get(curriculumCode) ?? null)
            : null,
          exclusionRisk,
          attributionHash: hash(
            canonicalJson({ observationHash, curriculumCode, status: attributionStatus }),
          ),
        }
      })

      records.push({
        schoolId,
        universityId: occurrence.id,
        year,
        admissionRound: round,
        track,
        countKind: kind,
        countValue: count.value,
        countMin: count.min,
        countMax: count.max,
        sourceLine: sourceLine.number,
        sourceExcerpt: text.slice(0, 1000),
        attributionStatus: status,
        reviewStatus:
          status === 'confirmed' && !['reported', 'estimated', 'interviews'].includes(kind)
            ? 'reviewed'
            : 'extracted',
        observationHash,
        attributions,
      })
    }
  }
  return records
}

function buildCleanResult(
  inputPath: string,
  schoolCatalog: CatalogSchool[],
  universityCatalog: CatalogUniversity[],
): CleanResult {
  const markdown = readFileSync(inputPath, 'utf8')
  const blocks = extractSchoolBlocks(markdown)
  const catalogById = new Map(schoolCatalog.map((school) => [school.id, school]))
  const universityIds = new Set(universityCatalog.map((university) => university.id))
  const schoolMap = new Map<string, CleanSchool>()
  const programsByKey = new Map<string, ProgramRecord>()
  const skipped: Record<string, number> = {
    missing_year: 0,
    missing_or_non_atomic_count: 0,
    invalid_count: 0,
    curriculum_backfill_needed: 0,
    university_not_in_catalog: 0,
    multi_year_aggregate: 0,
  }
  const allObservations: ObservationRecord[] = []

  for (const block of blocks) {
    const schoolId = schoolIdFor(block)
    const catalog = catalogById.get(schoolId)
    const existing = schoolMap.get(schoolId)
    if (existing) {
      if (!existing.headings.includes(block.title)) existing.headings.push(block.title)
    } else {
      schoolMap.set(schoolId, {
        id: schoolId,
        nameLocal: catalog?.name_cn || block.displayName,
        nameEn: catalog?.name_en || block.displayName,
        region: block.region,
        matchedExisting: Boolean(catalog),
        headings: [block.title],
      })
    }

    const blockPrograms = extractPrograms(block, schoolId)
    for (const program of blockPrograms) {
      const key = `${schoolId}|${program.curriculumCode}`
      const current = programsByKey.get(key)
      if (!current || program.sourceExcerpt.length > current.sourceExcerpt.length) {
        programsByKey.set(key, program)
      }
    }
    const availablePrograms = [...programsByKey.values()].filter(
      (program) => program.schoolId === schoolId,
    )
    const observations = extractObservations(block, schoolId, availablePrograms, skipped)
    for (const observation of observations) {
      if (!universityIds.has(observation.universityId)) {
        skipped.university_not_in_catalog += 1
        continue
      }
      for (const attribution of observation.attributions) {
        const key = `${schoolId}|${attribution.curriculumCode}`
        if (programsByKey.has(key)) continue
        const programHash = hash(
          canonicalJson({
            schoolId,
            curriculumCode: attribution.curriculumCode,
            sourceLine: observation.sourceLine,
          }),
        )
        programsByKey.set(key, {
          schoolId,
          curriculumCode: attribution.curriculumCode,
          role: 'unknown',
          validFromYear: null,
          firstGraduatingYear: null,
          validToYear: null,
          isSingleTrack: false,
          sourceLine: observation.sourceLine,
          sourceExcerpt: observation.sourceExcerpt,
          programHash,
        })
      }
      allObservations.push(observation)
    }
  }

  for (const observation of allObservations) {
    if (observation.attributions.length > 0) continue
    const programs = [...programsByKey.values()].filter(
      (program) =>
        program.schoolId === observation.schoolId && ELIGIBLE.has(program.curriculumCode),
    )
    const explicit = explicitCurricula(observation.sourceExcerpt).filter((code) =>
      ELIGIBLE.has(code),
    )
    const codes = explicit.length ? explicit : programs.map((program) => program.curriculumCode)
    if (codes.length === 0) continue
    const status = statusFor(observation.sourceExcerpt)
    observation.attributionStatus = status
    observation.attributions = [...new Set(codes)].map((curriculumCode) => ({
      curriculumCode,
      status,
      basis: basisFor(
        observation.sourceExcerpt,
        status,
        programs.length === 1 && programs[0].isSingleTrack,
      ),
      allocationKind: codes.length === 1 ? ('full' as const) : ('unallocated' as const),
      allocatedCount: null,
      exclusionRisk: /排除风险|若为中加|可能.*(?:OSSD|DSE|VCE|中加|日本)/.test(
        observation.sourceExcerpt,
      ),
      attributionHash: hash(
        canonicalJson({ observationHash: observation.observationHash, curriculumCode, status }),
      ),
    }))
  }
  for (const observation of allObservations) {
    for (const attribution of observation.attributions) {
      const key = `${observation.schoolId}|${attribution.curriculumCode}`
      if (programsByKey.has(key)) continue
      const programHash = hash(
        canonicalJson({
          schoolId: observation.schoolId,
          curriculumCode: attribution.curriculumCode,
          sourceLine: observation.sourceLine,
        }),
      )
      programsByKey.set(key, {
        schoolId: observation.schoolId,
        curriculumCode: attribution.curriculumCode,
        role: 'unknown',
        validFromYear: null,
        firstGraduatingYear: null,
        validToYear: null,
        isSingleTrack: false,
        sourceLine: observation.sourceLine,
        sourceExcerpt: observation.sourceExcerpt,
        programHash,
      })
    }
  }

  const signature = (record: ObservationRecord) =>
    canonicalJson({
      schoolId: record.schoolId,
      universityId: record.universityId,
      year: record.year,
      admissionRound: record.admissionRound,
      track: record.track,
      countKind: record.countKind,
      countValue: record.countValue,
      countMin: record.countMin,
      countMax: record.countMax,
      attributionStatus: record.attributionStatus,
      curricula: record.attributions.map((attribution) => attribution.curriculumCode).sort(),
    })
  const seen = new Set<string>()
  const observations = allObservations.filter((record) => {
    const key = signature(record)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  const schools = [...schoolMap.values()].sort((a, b) => a.id.localeCompare(b.id))
  const programs = [...programsByKey.values()].sort(
    (a, b) =>
      a.schoolId.localeCompare(b.schoolId) || a.curriculumCode.localeCompare(b.curriculumCode),
  )
  const observationsByStatus: Record<AttributionStatus, number> = {
    confirmed: 0,
    inferred: 0,
    possible: 0,
    excluded: 0,
  }
  const observationsByTrack: Record<string, number> = { AP: 0, IB: 0, ALEVEL: 0, unassigned: 0 }
  for (const observation of observations) {
    observationsByStatus[observation.attributionStatus] += 1
    observationsByTrack[observation.track ?? 'unassigned'] += 1
  }

  const sourceStat = statSync(inputPath)
  return {
    schemaVersion: 1,
    source: {
      filename: basename(inputPath),
      sha256: hash(markdown),
      byteSize: sourceStat.size,
      capturedAt: sourceStat.mtime.toISOString(),
    },
    schools,
    programs,
    observations,
    report: {
      detectedSchoolBlocks: blocks.length,
      uniqueSchools: schools.length,
      matchedExistingSchools: schools.filter((school) => school.matchedExisting).length,
      newSchools: schools.filter((school) => !school.matchedExisting).length,
      programRows: programs.length,
      observationRows: observations.length,
      attributionRows: observations.reduce(
        (sum, observation) => sum + observation.attributions.length,
        0,
      ),
      observationsByStatus,
      observationsByTrack,
      skipped,
      duplicateClaimsRemoved: allObservations.length - observations.length,
      schoolHeadingMap: blocks.map((block) => {
        const id = schoolIdFor(block)
        return { heading: block.title, institutionId: id, matchedExisting: catalogById.has(id) }
      }),
    },
  }
}

function buildSql(result: CleanResult, universities: CatalogUniversity[]): string {
  const sourceId = 'course-attribution-2023-2026'
  const sourceUrn = 'urn:ivy-map:curated:course-attribution:2023-2026'
  const runId = `course-attribution-${result.source.sha256.slice(0, 16)}`
  const artifactSelect = `(SELECT id FROM source_artifacts WHERE source_id = ${sql(sourceId)} AND sha256 = ${sql(result.source.sha256)})`
  const statements = ['\\set ON_ERROR_STOP on', 'BEGIN;', 'SET LOCAL ROLE ivy_map_owner;']

  statements.push(
    `INSERT INTO institutions (id, kind, name_en, name_local, country_code, status) VALUES ('ivy-map-research', 'system', 'IVY Map Research', 'IVY Map 数据研究', 'CN', 'active') ON CONFLICT (id) DO UPDATE SET name_en = EXCLUDED.name_en, name_local = EXCLUDED.name_local, updated_at = now();`,
    `INSERT INTO sources (id, institution_id, source_type, dataset_kind, title, canonical_url, confidence, access_status, first_seen_at, last_checked_at) VALUES (${sql(sourceId)}, 'ivy-map-research', 'report', 'feeder_report', ${sql('IV Map 课程部门归因（2023-2026）')}, ${sql(sourceUrn)}, 'L2', 'captured', ${sql(result.source.capturedAt)}::timestamptz, ${sql(result.source.capturedAt)}::timestamptz) ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, canonical_url = EXCLUDED.canonical_url, confidence = EXCLUDED.confidence, access_status = EXCLUDED.access_status, last_checked_at = EXCLUDED.last_checked_at;`,
    `INSERT INTO crawl_runs (run_id, tool_version, seed_file, started_at, finished_at, status, seed_count, fetched_source_count, failed_source_count, artifact_count, discovered_link_count, manifest_sha256, imported_at) VALUES (${sql(runId)}, 'course-attribution-cleaner/1', ${sql(result.source.filename)}, ${sql(result.source.capturedAt)}::timestamptz, ${sql(result.source.capturedAt)}::timestamptz, 'completed', 1, 1, 0, 1, 0, ${sql(result.source.sha256)}, now()) ON CONFLICT (run_id) DO UPDATE SET imported_at = now();`,
    `INSERT INTO source_artifacts (source_id, first_seen_run_id, last_seen_run_id, artifact_kind, requested_url, final_url, sha256, mime_type, byte_size, local_path, captured_at) VALUES (${sql(sourceId)}, ${sql(runId)}, ${sql(runId)}, 'document', ${sql(sourceUrn)}, NULL, ${sql(result.source.sha256)}, 'text/markdown', ${result.source.byteSize}, ${sql(`.data/course-attribution/${result.source.filename}`)}, ${sql(result.source.capturedAt)}::timestamptz) ON CONFLICT (source_id, sha256) DO UPDATE SET last_seen_run_id = EXCLUDED.last_seen_run_id, byte_size = EXCLUDED.byte_size, local_path = EXCLUDED.local_path, captured_at = EXCLUDED.captured_at;`,
  )

  for (const university of universities) {
    statements.push(
      `INSERT INTO institutions (id, kind, name_en, name_local, country_code, status) VALUES (${sql(university.id)}, 'university', ${sql(university.name_en)}, ${sql(university.name_cn)}, ${sql(university.country)}, 'active') ON CONFLICT (id) DO UPDATE SET kind = EXCLUDED.kind, name_en = EXCLUDED.name_en, name_local = EXCLUDED.name_local, country_code = EXCLUDED.country_code, updated_at = now();`,
    )
  }
  for (const school of result.schools) {
    statements.push(
      `INSERT INTO institutions (id, kind, name_en, name_local, country_code, status) VALUES (${sql(school.id)}, 'high_school', ${sql(school.nameEn)}, ${sql(school.nameLocal)}, 'CN', 'active') ON CONFLICT (id) DO UPDATE SET kind = EXCLUDED.kind, name_en = EXCLUDED.name_en, name_local = EXCLUDED.name_local, country_code = EXCLUDED.country_code, updated_at = now();`,
    )
  }
  for (const program of result.programs) {
    const locator = canonicalJson({
      document: result.source.filename,
      line: program.sourceLine,
      excerpt: program.sourceExcerpt,
    })
    statements.push(
      `INSERT INTO institution_curricula (institution_id, curriculum_code, role, valid_from_year, first_graduating_year, valid_to_year, is_single_track, source_artifact_id, source_locator, source_confidence, review_status, program_hash) VALUES (${sql(program.schoolId)}, ${sql(program.curriculumCode)}, ${sql(program.role)}, ${sql(program.validFromYear)}, ${sql(program.firstGraduatingYear)}, ${sql(program.validToYear)}, ${sql(program.isSingleTrack)}, ${artifactSelect}, ${sql(locator)}::jsonb, 'L2', 'reviewed', ${sql(program.programHash)}) ON CONFLICT (program_hash) DO UPDATE SET role = EXCLUDED.role, valid_from_year = EXCLUDED.valid_from_year, first_graduating_year = EXCLUDED.first_graduating_year, valid_to_year = EXCLUDED.valid_to_year, is_single_track = EXCLUDED.is_single_track, source_locator = EXCLUDED.source_locator, review_status = EXCLUDED.review_status;`,
    )
  }
  for (const observation of result.observations) {
    const locator = canonicalJson({
      document: result.source.filename,
      line: observation.sourceLine,
      excerpt: observation.sourceExcerpt,
    })
    statements.push(
      `INSERT INTO feeder_admission_observations (destination_university_id, origin_school_id, geography_id, granularity, academic_year_start, admission_round, track, count_kind, count_value, count_min, count_max, student_scope, is_complete, confidence, source_artifact_id, source_locator, review_status, observation_hash) VALUES (${sql(observation.universityId)}, ${sql(observation.schoolId)}, NULL, 'school', ${observation.year}, ${sql(observation.admissionRound)}, ${sql(observation.track)}, ${sql(observation.countKind)}, ${sql(observation.countValue)}, ${sql(observation.countMin)}, ${sql(observation.countMax)}, 'document_reported_school_program_outcome', false, 'L2', ${artifactSelect}, ${sql(locator)}::jsonb, ${sql(observation.reviewStatus)}, ${sql(observation.observationHash)}) ON CONFLICT (observation_hash) DO UPDATE SET track = EXCLUDED.track, count_kind = EXCLUDED.count_kind, count_value = EXCLUDED.count_value, count_min = EXCLUDED.count_min, count_max = EXCLUDED.count_max, source_artifact_id = EXCLUDED.source_artifact_id, source_locator = EXCLUDED.source_locator, review_status = EXCLUDED.review_status;`,
    )
    for (const attribution of observation.attributions) {
      const program = result.programs.find(
        (candidate) =>
          candidate.schoolId === observation.schoolId &&
          candidate.curriculumCode === attribution.curriculumCode,
      )
      if (!program)
        throw new Error(
          `missing program for ${observation.schoolId}/${attribution.curriculumCode}`,
        )
      statements.push(
        `INSERT INTO feeder_admission_attributions (observation_id, institution_curriculum_id, status, basis, allocation_kind, allocated_count, allocated_count_min, allocated_count_max, exclusion_risk, note, source_artifact_id, source_locator, attribution_hash) VALUES ((SELECT id FROM feeder_admission_observations WHERE observation_hash = ${sql(observation.observationHash)}), (SELECT id FROM institution_curricula WHERE program_hash = ${sql(program.programHash)}), ${sql(attribution.status)}, ${sql(attribution.basis)}, ${sql(attribution.allocationKind)}, ${sql(attribution.allocatedCount)}, NULL, NULL, ${sql(attribution.exclusionRisk)}, NULL, ${artifactSelect}, ${sql(locator)}::jsonb, ${sql(attribution.attributionHash)}) ON CONFLICT (attribution_hash) DO UPDATE SET status = EXCLUDED.status, basis = EXCLUDED.basis, allocation_kind = EXCLUDED.allocation_kind, allocated_count = EXCLUDED.allocated_count, allocated_count_min = EXCLUDED.allocated_count_min, allocated_count_max = EXCLUDED.allocated_count_max, exclusion_risk = EXCLUDED.exclusion_risk, source_locator = EXCLUDED.source_locator;`,
      )
    }
  }

  statements.push('COMMIT;', '')
  return statements.join('\n')
}

function validateResult(result: CleanResult, universities: CatalogUniversity[]): void {
  const schoolIds = new Set(result.schools.map((school) => school.id))
  const universityIds = new Set(universities.map((university) => university.id))
  const programKeys = new Set(
    result.programs.map((program) => `${program.schoolId}|${program.curriculumCode}`),
  )
  const observationHashes = new Set<string>()
  const attributionHashes = new Set<string>()

  if (schoolIds.size !== result.schools.length) throw new Error('duplicate cleaned school id')
  if (result.report.detectedSchoolBlocks < 150)
    throw new Error('too few school blocks detected')
  if (new Set(result.observations.map((row) => row.universityId)).size !== 31) {
    throw new Error('expected observations for all 31 source universities')
  }

  for (const program of result.programs) {
    if (!schoolIds.has(program.schoolId))
      throw new Error(`program has unknown school: ${program.schoolId}`)
  }
  for (const observation of result.observations) {
    if (!schoolIds.has(observation.schoolId)) {
      throw new Error(`observation has unknown school: ${observation.schoolId}`)
    }
    if (!universityIds.has(observation.universityId)) {
      throw new Error(`observation has unknown university: ${observation.universityId}`)
    }
    if (observation.year < 2020 || observation.year > 2026) {
      throw new Error(`observation has invalid year: ${observation.year}`)
    }
    if (observationHashes.has(observation.observationHash)) {
      throw new Error(`duplicate observation hash: ${observation.observationHash}`)
    }
    observationHashes.add(observation.observationHash)
    if (observation.attributions.length === 0) {
      throw new Error(
        `observation has no curriculum attribution: ${observation.observationHash}`,
      )
    }
    if (observation.track && observation.attributionStatus !== 'confirmed') {
      throw new Error(
        `non-confirmed observation received ranking track: ${observation.observationHash}`,
      )
    }
    const partial = observation.attributions.filter(
      (attribution) => attribution.allocationKind === 'partial',
    )
    if (partial.length) {
      if (
        partial.length !== observation.attributions.length ||
        observation.countValue == null
      ) {
        throw new Error(`incomplete partial attribution: ${observation.observationHash}`)
      }
      const allocated = partial.reduce(
        (sum, attribution) => sum + (attribution.allocatedCount ?? 0),
        0,
      )
      if (allocated !== observation.countValue) {
        throw new Error(`partial attribution total mismatch: ${observation.observationHash}`)
      }
    }
    for (const attribution of observation.attributions) {
      if (!programKeys.has(`${observation.schoolId}|${attribution.curriculumCode}`)) {
        throw new Error(
          `attribution has no school curriculum: ${observation.schoolId}/${attribution.curriculumCode}`,
        )
      }
      if (attributionHashes.has(attribution.attributionHash)) {
        throw new Error(`duplicate attribution hash: ${attribution.attributionHash}`)
      }
      attributionHashes.add(attribution.attributionHash)
    }
  }
}

function main() {
  const inputArg = arg('--input')
  const outputArg = arg('--output-dir')
  if (!inputArg || !outputArg) {
    throw new Error(
      'usage: pnpm exec tsx scripts/data/clean-course-attribution.ts --input <markdown> --output-dir .data/course-attribution',
    )
  }
  const inputPath = resolve(inputArg)
  const outputDir = resolve(outputArg)
  const schools = readCsv<CatalogSchool>(resolve('data/raw/schools.csv'))
  const universities = readCsv<CatalogUniversity>(resolve('data/raw/universities.csv'))
  const result = buildCleanResult(inputPath, schools, universities)
  validateResult(result, universities)

  mkdirSync(outputDir, { recursive: true })
  copyFileSync(inputPath, resolve(outputDir, basename(inputPath)))
  writeFileSync(resolve(outputDir, 'cleaned.json'), `${JSON.stringify(result, null, 2)}\n`)
  writeFileSync(
    resolve(outputDir, 'report.json'),
    `${JSON.stringify(result.report, null, 2)}\n`,
  )
  writeFileSync(resolve(outputDir, 'import.sql'), buildSql(result, universities))

  console.log(JSON.stringify(result.report, null, 2))
}

if (import.meta.url === `file://${process.argv[1]}`) main()
