import { forwardRef, InputHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes, ReactNode } from 'react'
import { clsx } from 'clsx'
import { Loader2 } from 'lucide-react'

// ─── Button ────────────────────────────────────────────────────────────────
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  icon?: ReactNode
}

export function Button({ variant = 'primary', size = 'md', loading, icon, children, className, disabled, ...props }: ButtonProps) {
  return (
    <button
      className={clsx('btn', `btn-${variant}`, `btn-${size}`, className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : icon}
      {children}
    </button>
  )
}

// ─── Input ─────────────────────────────────────────────────────────────────
interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-gray-700 mb-1">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={clsx('input', error && 'input-error', className)}
          {...props}
        />
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        {hint && !error && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
      </div>
    )
  }
)
Input.displayName = 'Input'

// ─── Textarea ──────────────────────────────────────────────────────────────
interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, className, ...props }, ref) => (
    <div className="w-full">
      {label && <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>}
      <textarea ref={ref} className={clsx('input min-h-[90px] resize-y', error && 'input-error', className)} {...props} />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
)
Textarea.displayName = 'Textarea'

// ─── Select ────────────────────────────────────────────────────────────────
interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  options: { value: string; label: string }[]
  placeholder?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, placeholder, className, ...props }, ref) => (
    <div className="w-full">
      {label && <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>}
      <select ref={ref} className={clsx('input', error && 'input-error', className)} {...props}>
        {placeholder && <option value="">{placeholder}</option>}
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
)
Select.displayName = 'Select'

// ─── Card ──────────────────────────────────────────────────────────────────
export function Card({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={clsx('card p-5', className)} {...props}>
      {children}
    </div>
  )
}

export function CardHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between mb-4">
      <div>
        <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
        {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

// ─── Badge ─────────────────────────────────────────────────────────────────
const badgeVariants = {
  blue: 'badge-blue', green: 'badge-green', amber: 'badge-amber',
  red: 'badge-red', purple: 'badge-purple', gray: 'badge-gray',
} as const

export function Badge({ children, variant = 'gray', className }: {
  children: ReactNode; variant?: keyof typeof badgeVariants; className?: string
}) {
  return <span className={clsx('badge', badgeVariants[variant], className)}>{children}</span>
}

// ─── Status Badge ──────────────────────────────────────────────────────────
const statusMap: Record<string, { variant: keyof typeof badgeVariants; label: string }> = {
  draft:      { variant: 'gray',   label: 'Draft' },
  published:  { variant: 'blue',   label: 'Published' },
  live:       { variant: 'green',  label: '● Live' },
  completed:  { variant: 'gray',   label: 'Completed' },
  cancelled:  { variant: 'red',    label: 'Cancelled' },
  active:     { variant: 'green',  label: 'Active' },
  inactive:   { variant: 'gray',   label: 'Inactive' },
  suspended:  { variant: 'red',    label: 'Suspended' },
  easy:       { variant: 'green',  label: 'Easy' },
  medium:     { variant: 'amber',  label: 'Medium' },
  hard:       { variant: 'red',    label: 'Hard' },
}

export function StatusBadge({ status }: { status: string }) {
  const { variant, label } = statusMap[status] ?? { variant: 'gray' as const, label: status }
  return <Badge variant={variant}>{label}</Badge>
}

// ─── Spinner ───────────────────────────────────────────────────────────────
export function Spinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sz = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-8 h-8' }[size]
  return <Loader2 className={clsx(sz, 'animate-spin text-brand-600')} />
}

export function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[300px]">
      <Spinner size="lg" />
    </div>
  )
}

// ─── Modal ─────────────────────────────────────────────────────────────────
export function Modal({ open, onClose, title, children, footer }: {
  open: boolean; onClose: () => void; title: string;
  children: ReactNode; footer?: ReactNode
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg animate-fade-in">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors text-lg leading-none">×</button>
        </div>
        <div className="px-6 py-5">{children}</div>
        {footer && <div className="px-6 py-4 border-t border-gray-100 flex gap-2 justify-end">{footer}</div>}
      </div>
    </div>
  )
}

// ─── Empty State ───────────────────────────────────────────────────────────
export function EmptyState({ icon, title, description, action }: {
  icon?: string; title: string; description?: string; action?: ReactNode
}) {
  return (
    <div className="text-center py-12 px-4">
      {icon && <div className="text-4xl mb-3">{icon}</div>}
      <h3 className="text-sm font-semibold text-gray-700 mb-1">{title}</h3>
      {description && <p className="text-xs text-gray-500 mb-4">{description}</p>}
      {action}
    </div>
  )
}

// ─── Stat Card ─────────────────────────────────────────────────────────────
export function StatCard({ label, value, sub, icon, color = 'blue' }: {
  label: string; value: string | number; sub?: string; icon?: string
  color?: 'blue' | 'green' | 'amber' | 'red' | 'purple'
}) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600', green: 'bg-green-50 text-green-600',
    amber: 'bg-amber-50 text-amber-600', red: 'bg-red-50 text-red-600',
    purple: 'bg-purple-50 text-purple-600',
  }
  return (
    <div className="card p-4 relative overflow-hidden">
      <div className="text-xs font-medium text-gray-500 mb-1">{label}</div>
      <div className="text-2xl font-bold text-gray-900 leading-none">{value}</div>
      {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
      {icon && (
        <div className={clsx('absolute right-4 top-4 w-9 h-9 rounded-lg flex items-center justify-center text-base', colors[color])}>
          {icon}
        </div>
      )}
    </div>
  )
}

// ─── Tabs ──────────────────────────────────────────────────────────────────
export function Tabs({ tabs, active, onChange }: {
  tabs: { key: string; label: string }[]
  active: string
  onChange: (key: string) => void
}) {
  return (
    <div className="flex border-b border-gray-200 mb-5">
      {tabs.map(t => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={clsx(
            'px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
            active === t.key
              ? 'border-brand-600 text-brand-700'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

// ─── Progress Bar ──────────────────────────────────────────────────────────
export function ProgressBar({ value, color = 'blue', className }: {
  value: number; color?: 'blue' | 'green' | 'amber' | 'red'; className?: string
}) {
  const colors = { blue: 'bg-brand-600', green: 'bg-green-500', amber: 'bg-amber-500', red: 'bg-red-500' }
  return (
    <div className={clsx('progress', className)}>
      <div className={clsx('progress-fill', colors[color])} style={{ width: `${Math.min(100, value)}%` }} />
    </div>
  )
}

// ─── Search Bar ────────────────────────────────────────────────────────────
export function SearchBar({ value, onChange, placeholder = 'Search...' }: {
  value: string; onChange: (v: string) => void; placeholder?: string
}) {
  return (
    <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 w-full max-w-xs">
      <span className="text-gray-400 text-sm">🔍</span>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="border-0 outline-none text-sm text-gray-700 bg-transparent w-full placeholder:text-gray-400"
      />
    </div>
  )
}

// ─── Toggle ────────────────────────────────────────────────────────────────
export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={clsx(
          'relative w-10 h-5 rounded-full transition-colors',
          checked ? 'bg-brand-600' : 'bg-gray-200'
        )}
      >
        <span className={clsx(
          'absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform',
          checked && 'translate-x-5'
        )} />
      </button>
      {label && <span className="text-sm text-gray-600">{label}</span>}
    </div>
  )
}

// ─── Avatar ────────────────────────────────────────────────────────────────
const avatarColors = ['bg-blue-100 text-blue-700', 'bg-green-100 text-green-700',
  'bg-purple-100 text-purple-700', 'bg-amber-100 text-amber-700', 'bg-red-100 text-red-700']

export function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  const colorIdx = name.charCodeAt(0) % avatarColors.length
  const sizes = { sm: 'w-7 h-7 text-xs', md: 'w-9 h-9 text-sm', lg: 'w-12 h-12 text-base' }
  return (
    <div className={clsx('rounded-full flex items-center justify-center font-semibold flex-shrink-0', sizes[size], avatarColors[colorIdx])}>
      {initials}
    </div>
  )
}

// ─── Score Ring ────────────────────────────────────────────────────────────
export function ScoreRing({ pct, size = 80 }: { pct: number; size?: number }) {
  const r = 32; const circ = 2 * Math.PI * r; const offset = circ * (1 - pct / 100)
  const color = pct >= 75 ? '#16a34a' : pct >= 50 ? '#d97706' : '#dc2626'
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 80 80" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="40" cy="40" r={r} fill="none" stroke="#e5e7eb" strokeWidth="8" />
        <circle cx="40" cy="40" r={r} fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={`${circ} ${circ}`} strokeDashoffset={offset} strokeLinecap="round" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span style={{ fontSize: size * 0.18, fontWeight: 700, color }}>{pct}%</span>
      </div>
    </div>
  )
}
