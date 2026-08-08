'use client'

import { useEffect, useId, useRef, useState } from 'react'

export function AdmissionRateUnavailableHint({ note }: { note: string }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLSpanElement>(null)
  const tooltipId = useId()

  useEffect(() => {
    if (!open) return

    function closeOnOutsidePointer(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('pointerdown', closeOnOutsidePointer)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  return (
    <span ref={rootRef} className="group/rate-hint relative mt-1 inline-block">
      <button
        type="button"
        data-tap
        aria-expanded={open}
        aria-describedby={open ? tooltipId : undefined}
        onClick={() => setOpen((current) => !current)}
        className="border-b border-dotted border-ink/35 bg-transparent p-0 text-left text-[10px] leading-relaxed text-ink/50 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:border-ink hover:text-ink focus-visible:text-ink motion-reduce:transition-none"
      >
        录取率不适用 · 说明
      </button>

      <span
        id={tooltipId}
        role="tooltip"
        className={`absolute bottom-full left-0 z-30 mb-2 w-[min(280px,calc(100vw-3rem))] border border-ink/25 bg-paper px-3 py-2.5 text-left text-[11px] leading-relaxed text-ink/70 transition-[opacity,transform,visibility] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none group-hover/rate-hint:visible group-hover/rate-hint:translate-y-0 group-hover/rate-hint:opacity-100 ${
          open
            ? 'visible translate-y-0 opacity-100'
            : 'invisible translate-y-1 opacity-0'
        }`}
      >
        {note}
      </span>
    </span>
  )
}

export default AdmissionRateUnavailableHint
