import type { Metadata } from 'next'
import './globals.css'

const TITLE = 'IVY Map · 大学画像与国内生源校'
const DESC =
  '浏览大学画像、官方录取率与四维画像指纹，再查看 AP、IB、A-Level 课程路径和对应国内高中去向证据。'

// US-8.5：微信分享主要读 title，所以 title 要能独立说清产品是什么
export const metadata: Metadata = {
  title: { default: TITLE, template: '%s · IVY Map' },
  description: DESC,
  openGraph: { title: TITLE, description: DESC, type: 'website', locale: 'zh_CN' },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESC },
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" className="h-full antialiased" data-scroll-behavior="smooth">
      <body className="min-h-full flex flex-col bg-paper text-ink">
        <div className="flex-1">{children}</div>
        <footer className="mx-3 mb-3 mt-16 rounded-[16px] bg-forest-deep px-5 py-6 text-xs leading-relaxed text-paper/70 sm:mx-6 sm:px-8 sm:py-7">
          <div className="mx-auto grid max-w-6xl gap-3 sm:grid-cols-[auto_1fr] sm:gap-8">
            <p className="label text-sage">IVY MAP · 数据说明</p>
            {/* PRD §12 免责声明 —— 页脚与分享长图两处必须出现 */}
            <p className="max-w-4xl">
              本站数据来自学校官方公开发布、公开媒体报道及公开行业报告，由 IVY Map
              整理，可能存在滞后或误差，不构成任何录取承诺或升学建议。数据如有出入，欢迎通过反馈入口提交更正。
            </p>
          </div>
        </footer>
      </body>
    </html>
  )
}
