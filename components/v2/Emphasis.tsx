// 只认 `**粗体**` 一种标记的文本渲染。
//
// 术语教学那几段里的强调是**内容的一部分** —— 哪一句是家长最容易搞错的，
// 靠字重指出来比藏在段落中间有效得多。但为此引一个 markdown 解析器不值得，
// 文案是我们自己写的，一个 split 就够。
//
// 字重用 500 而不是 700：design-system.md §2 —— 中文字体加粗到 600 以上会糊。

export function Emphasis({ text, className }: { text: string; className?: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return (
    <span className={className}>
      {parts.map((part, i) =>
        part.startsWith('**') && part.endsWith('**') && part.length > 4 ? (
          <strong key={i} className="font-medium">
            {part.slice(2, -2)}
          </strong>
        ) : (
          part
        ),
      )}
    </span>
  )
}

export default Emphasis
