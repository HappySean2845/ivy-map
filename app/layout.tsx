import type { Metadata } from 'next'
import './globals.css'

const TITLE = 'IVY Map · 常春藤择校地图'
const DESC =
  '想去哪所大学，就该上哪所高中。反推国内生源校榜单，按人均命中率排序，并告诉你报不报得了。'

// US-8.5：微信分享主要读 title，所以 title 要能独立说清产品是什么
export const metadata: Metadata = {
  title: { default: TITLE, template: '%s · IVY Map' },
  description: DESC,
  openGraph: { title: TITLE, description: DESC, type: 'website', locale: 'zh_CN' },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESC },
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-paper text-ink">
        <div className="flex-1">{children}</div>
        <footer className="border-t border-ink/15 px-5 py-6 text-xs leading-relaxed text-ink/60">
          {/* PRD §12 免责声明 —— 页脚与分享长图两处必须出现 */}
          本站数据来自学校官方公开发布、公开媒体报道及公开行业报告，由 IVY Map
          整理，可能存在滞后或误差，不构成任何录取承诺或升学建议。数据如有出入，欢迎通过反馈入口提交更正。
        </footer>
      </body>
    </html>
  )
}
