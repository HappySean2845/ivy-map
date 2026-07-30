// 来源链接体检。
//
//   pnpm data:links
//
// 为什么需要这个：产品的第一原则是「每个数字都能点开看到来源链接」，
// 而链接会烂——抽查里 16 条就撞到 1 个 502。一个点开是 502 的来源，
// 比没有来源好不了多少：家长点了发现打不开，只会更不信。
//
// 不放进 pnpm build：构建跑在 Vercel 的机器上，很多中文站点从那边根本
// 连不通，会把整个部署卡死在一件与代码无关的事情上。所以做成独立命令，
// 定期人工跑，结果写回 sources.csv 的备注供决策。

import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import Papa from 'papaparse'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const RAW = resolve(ROOT, 'data/raw')

interface Row {
  id: string
  type: string
  title: string
  url: string
  confidence: string
}

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'

const sources = Papa.parse<Row>(readFileSync(resolve(RAW, 'sources.csv'), 'utf8').trim(), {
  header: true,
  skipEmptyLines: true,
}).data

// 哪些来源真的在被引用 —— 没被引用的死链不重要
const referenced = new Set<string>()
for (const f of ['admissions.csv', 'cohorts.csv', 'requirements.csv']) {
  const rows = Papa.parse<Record<string, string>>(
    readFileSync(resolve(RAW, f), 'utf8').trim(),
    { header: true, skipEmptyLines: true },
  ).data
  for (const r of rows) if (r.source_id) referenced.add(r.source_id)
}

type Verdict = 'ok' | 'dead' | 'redirect' | 'timeout'

async function probe(url: string): Promise<{ verdict: Verdict; detail: string }> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 20_000)
  try {
    // 有些站点对 HEAD 返回 405，统一用 GET 但只读 header
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: { 'User-Agent': UA },
      signal: ctrl.signal,
    })
    if (res.ok) {
      return {
        verdict: res.url !== url ? 'redirect' : 'ok',
        detail: res.url !== url ? `${res.status} → ${res.url}` : String(res.status),
      }
    }
    return { verdict: 'dead', detail: String(res.status) }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { verdict: msg.includes('abort') ? 'timeout' : 'dead', detail: msg.slice(0, 60) }
  } finally {
    clearTimeout(timer)
  }
}

async function main() {
  const results: { row: Row; verdict: Verdict; detail: string; used: boolean }[] = []

  // 并发 6 路，别把对方站点打疼了
  const queue = [...sources]
  await Promise.all(
    Array.from({ length: 6 }, async () => {
      for (;;) {
        const row = queue.shift()
        if (!row) return
        const r = await probe(row.url)
        results.push({ row, ...r, used: referenced.has(row.id) })
      }
    }),
  )

  results.sort((a, b) => Number(b.used) - Number(a.used) || a.row.id.localeCompare(b.row.id))

  const mark: Record<Verdict, string> = { ok: '✓', redirect: '→', dead: '✗', timeout: '⏱' }
  console.log('\n' + '='.repeat(70))
  console.log('来源链接体检')
  console.log('='.repeat(70))
  for (const r of results) {
    const used = r.used ? '有引用' : '未引用'
    console.log(
      `${mark[r.verdict]} [${r.row.confidence}] ${used}  ${r.row.id}  ${r.detail}\n    ${r.row.url}`,
    )
  }

  const badUsed = results.filter(
    (r) => r.used && (r.verdict === 'dead' || r.verdict === 'timeout'),
  )
  const okCount = results.filter((r) => r.verdict === 'ok' || r.verdict === 'redirect').length
  console.log('\n' + '-'.repeat(70))
  console.log(`可访问 ${okCount} / ${results.length}`)
  if (badUsed.length) {
    console.log(`\n⚠  ${badUsed.length} 个**正在被引用**的来源打不开：`)
    for (const r of badUsed) console.log(`   ${r.row.id}（${r.detail}）— ${r.row.title}`)
    console.log(
      '\n   「每个数字都能点开看到来源」是对用户的承诺。' +
        '\n   处理顺序：① 找替代来源换掉 ② 找不到就删掉引用它的数据行' +
        '\n   不要留着死链假装有出处。',
    )
  }
  console.log()
}

main()
