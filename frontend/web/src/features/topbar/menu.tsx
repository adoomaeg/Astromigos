import clsx from 'clsx'
import type { ReactNode } from 'react'
import { Kbd } from '../../components/ui'

/**
 * Row style for items inside the top bar Tools menu (role="menu").
 * Shared by the Tools menu itself and by the feature buttons rendered with variant="menuitem".
 */
export const MENU_ITEM =
  'focus-ring flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left text-ink-300 outline-none transition-colors hover:bg-white/[0.06] hover:text-ink-100 focus:bg-white/[0.06] focus:text-ink-100'

/** Icon, label, optional one line hint and an optional right side slot (shortcut key or state). */
export function MenuRow({ icon, label, hint, right, className }: { icon: ReactNode; label: string; hint?: string; right?: ReactNode; className?: string }) {
  return (
    <>
      <span className={clsx('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.04] text-accent ring-1 ring-white/[0.06]', className)} aria-hidden>
        {icon}
      </span>
      <span className="min-w-0 flex-1 leading-tight">
        <span className="block text-[13px] font-semibold text-ink-100">{label}</span>
        {hint && <span className="mt-0.5 block text-[11px] text-ink-500">{hint}</span>}
      </span>
      {right}
    </>
  )
}

export function MenuKey({ k }: { k: string }) {
  return (
    <span className="shrink-0" aria-hidden>
      <Kbd>{k}</Kbd>
    </span>
  )
}
