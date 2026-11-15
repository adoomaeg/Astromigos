import { Database } from 'lucide-react'
import { lazy, Suspense, useState } from 'react'
import { TOPBAR_BUTTON } from '../mission/Modal'
import { MENU_ITEM, MenuRow } from '../topbar/menu'

// The dialog (charts, real datasets, model card) loads only when first opened.
const DataModelDialog = lazy(() => import('./DataModelDialog'))

/**
 * Opens the Data and model panel: real public datasets (NASA OSDR), device adapters, model card.
 * variant="menuitem" renders it as a row of the top bar Tools menu.
 */
export function DataSourcesButton({ variant = 'toolbar' }: { variant?: 'toolbar' | 'menuitem' }) {
  const [open, setOpen] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const onOpen = () => {
    setLoaded(true)
    setOpen(true)
  }
  return (
    <>
      {variant === 'menuitem' ? (
        <button
          type="button"
          role="menuitem"
          tabIndex={-1}
          data-tour="datasources"
          aria-haspopup="dialog"
          onClick={onOpen}
          onPointerEnter={() => setLoaded(true)}
          onFocus={() => setLoaded(true)}
          className={MENU_ITEM}
        >
          <MenuRow icon={<Database size={16} />} label="Data and model" hint="Real NASA datasets, simulated devices, model card" />
        </button>
      ) : (
        <button
          type="button"
          data-tour="datasources"
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={onOpen}
          onPointerEnter={() => setLoaded(true)}
          title="Data and model: real NASA datasets, simulated devices, model card"
          className={TOPBAR_BUTTON}
        >
          <Database size={14} aria-hidden className="text-accent" />
          Data
        </button>
      )}
      {loaded && (
        <Suspense fallback={null}>
          <DataModelDialog open={open} onClose={() => setOpen(false)} />
        </Suspense>
      )}
    </>
  )
}
