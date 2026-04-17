import { NavLink, useNavigate } from 'react-router-dom'
import {
  ChevronLeft,
  ChevronRight,
  Database,
  History,
  LayoutDashboard,
  LogOut,
  MessagesSquare,
  PlugZap,
} from 'lucide-react'
import { useAuthStore } from '../../stores/authStore'
import { useQueryStore } from '../../stores/queryStore'
import { cn } from '../../lib/utils'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { Avatar, AvatarFallback } from '../ui/avatar'
import { Separator } from '../ui/separator'

const NAV = [
  { to: '/chat', icon: MessagesSquare, label: 'Query Chat', caption: 'Natural language to SQL' },
  { to: '/connect', icon: Database, label: 'Connect DB', caption: 'Source onboarding' },
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', caption: 'Metrics and outcomes' },
  { to: '/history', icon: History, label: 'History', caption: 'Previous executions' },
]

export default function Sidebar({ open, onToggle }) {
  const { user, logout } = useAuthStore()
  const { connected, dbType, schemaProfile } = useQueryStore()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <aside
      className={cn(
        'relative z-30 hidden h-screen shrink-0 self-start border-r border-sidebar-border bg-sidebar/95 backdrop-blur lg:sticky lg:top-0 lg:flex lg:flex-col',
        open ? 'w-80' : 'w-24'
      )}
    >
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary font-display text-lg font-extrabold text-primary-foreground">
          S
        </div>
        {open && (
          <div className="min-w-0">
            <div className="font-display text-lg font-extrabold tracking-tight">SmartQuery AI</div>
            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Engineering Console</div>
          </div>
        )}
      </div>

      <Separator />

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="space-y-2">
          {NAV.map(({ to, icon: Icon, label, caption }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  'group flex items-center gap-3 rounded-2xl border px-3 py-3 transition-colors',
                  open ? 'justify-start' : 'justify-center',
                  isActive
                    ? 'border-sidebar-border bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'border-transparent text-muted-foreground hover:border-sidebar-border hover:bg-sidebar-accent/60 hover:text-foreground'
                )
              }
            >
              {({ isActive }) => (
                <>
                  <div
                    className={cn(
                      'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border',
                      isActive ? 'border-sidebar-border bg-background text-foreground' : 'border-transparent bg-transparent'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  {open && (
                    <div className="min-w-0">
                      <div className="text-sm font-semibold">{label}</div>
                      <div className="text-xs text-muted-foreground">{caption}</div>
                    </div>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </div>

        {open && (
          <div className="rounded-2xl border bg-card p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <PlugZap className="h-4 w-4" />
              <div className="text-sm font-semibold">Source Status</div>
            </div>
            <div className="space-y-2 text-sm text-muted-foreground">
              <Badge variant={connected ? 'default' : 'secondary'} className="rounded-full px-3 py-1">
                {connected ? 'Connected' : 'Awaiting source'}
              </Badge>
              <p>
                {connected
                  ? `${dbType} active with ${schemaProfile?.overview?.table_count ?? 0} profiled tables.`
                  : 'Connect a database to enable schema-aware query generation.'}
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-3 border-t p-4">
        <div className={cn('flex items-center gap-3 rounded-2xl border bg-card p-3', !open && 'justify-center')}>
          <Avatar className="h-11 w-11">
            <AvatarFallback>{user?.username?.[0]?.toUpperCase() || 'U'}</AvatarFallback>
          </Avatar>
          {open && (
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{user?.username || 'User'}</div>
              <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{user?.role || 'member'}</div>
            </div>
          )}
        </div>

        <Button variant="outline" className={cn('w-full justify-start rounded-2xl', !open && 'justify-center px-0')} onClick={onToggle}>
          {open ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          {open && 'Collapse sidebar'}
        </Button>

        <Button variant="ghost" className={cn('w-full justify-start rounded-2xl', !open && 'justify-center px-0')} onClick={handleLogout}>
          <LogOut className="h-4 w-4" />
          {open && 'Sign out'}
        </Button>
      </div>
    </aside>
  )
}
