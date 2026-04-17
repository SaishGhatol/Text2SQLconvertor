import { useEffect, useMemo, useState } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { Database, LayoutDashboard, History, MessagesSquare, Menu } from 'lucide-react'
import Sidebar from './Sidebar'
import ChatPage from '../chat/ChatPage'
import DashboardPage from '../dashboard/DashboardPage'
import ConnectPage from '../query/ConnectPage'
import HistoryPage from '../query/HistoryPage'
import { useQueryStore } from '../../stores/queryStore'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { Separator } from '../ui/separator'
import { ModeToggle } from '../theme/ModeToggle'

const ROUTE_META = {
  '/chat': {
    title: 'Query Workspace',
    subtitle: 'Ask natural language questions, review generated SQL, and inspect results.',
    icon: MessagesSquare,
  },
  '/connect': {
    title: 'Data Source Studio',
    subtitle: 'Connect a database, inspect schema intelligence, and onboard data cleanly.',
    icon: Database,
  },
  '/dashboard': {
    title: 'Project Dashboard',
    subtitle: 'Track dataset coverage, analytics activity, and system outcomes.',
    icon: LayoutDashboard,
  },
  '/history': {
    title: 'Execution History',
    subtitle: 'Review prompts, generated queries, and prior runs.',
    icon: History,
  },
}

export default function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const location = useLocation()
  const { connected, dbType, schemaProfile } = useQueryStore()

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth < 1024) setSidebarOpen(false)
      if (window.innerWidth >= 1280) setSidebarOpen(true)
    }
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const meta = useMemo(() => ROUTE_META[location.pathname] || ROUTE_META['/chat'], [location.pathname])
  const Icon = meta.icon

  return (
    <div className="page-shell surface-grid flex min-h-screen bg-background">
      <Sidebar open={sidebarOpen} onToggle={() => setSidebarOpen((value) => !value)} />

      <div className="relative z-10 flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b bg-background/85 backdrop-blur">
          <div className="flex flex-col gap-4 px-4 py-4 sm:px-6 xl:px-8">
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-start gap-3">
                <Button variant="outline" size="icon" className="lg:hidden" onClick={() => setSidebarOpen((value) => !value)}>
                  <Menu className="h-4 w-4" />
                </Button>
                <div className="rounded-2xl border bg-card p-3 shadow-sm">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h1 className="font-display text-2xl font-extrabold tracking-tight text-foreground">{meta.title}</h1>
                  <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{meta.subtitle}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <ModeToggle />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={connected ? 'default' : 'secondary'} className="rounded-full px-3 py-1">
                {connected ? `${dbType} connected` : 'No source connected'}
              </Badge>
              <Badge variant="outline" className="rounded-full px-3 py-1">
                {schemaProfile?.overview?.table_count ?? 0} tables
              </Badge>
              <Badge variant="outline" className="rounded-full px-3 py-1">
                {schemaProfile?.overview?.total_columns ?? 0} columns
              </Badge>
            </div>
          </div>
          <Separator />
        </header>

        <main className="min-h-0 flex-1 overflow-auto px-3 py-3 sm:px-4 xl:px-6">
          <Routes>
            <Route path="/" element={<Navigate to="/chat" replace />} />
            <Route path="/chat" element={<ChatPage />} />
            <Route path="/connect" element={<ConnectPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="*" element={<Navigate to="/chat" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}
