import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Database, Lock, ShieldCheck, Sparkles, Zap } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuthStore } from '../../stores/authStore'
import { formatApiError } from '../../utils/errors'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs'
import { Badge } from '../ui/badge'
import { ModeToggle } from '../theme/ModeToggle'

const FEATURES = [
  'Schema-aware SQL generation with correction retries',
  'Interactive results, charting, and explainable outputs',
  'SQLite, MySQL, PostgreSQL, CSV onboarding, and saved datasource profiles',
]

const HIGHLIGHTS = [
  { value: '4', label: 'Data sources' },
  { value: 'Local', label: 'Offline capable' },
  { value: 'Explainable', label: 'SQL workflow' },
]

export default function AuthPage() {
  const [tab, setTab] = useState('login')
  const [form, setForm] = useState({ username: '', password: '', email: '' })
  const [loading, setLoading] = useState(false)
  const { login, signup } = useAuthStore()
  const navigate = useNavigate()

  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }))

  const handleSubmit = async (event) => {
    event.preventDefault()
    setLoading(true)
    try {
      if (tab === 'login') {
        await login(form.username, form.password)
        toast.success('Welcome back')
        navigate('/')
      } else {
        await signup(form.username, form.password, form.email)
        toast.success('Account created. Please sign in.')
        setTab('login')
      }
    } catch (error) {
      toast.error(formatApiError(error, 'Authentication failed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page-shell relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-8 sm:px-6">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[6%] top-[10%] h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute bottom-[12%] right-[10%] h-56 w-56 rounded-full bg-amber-500/10 blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-background via-background/80 to-transparent" />
      </div>

      <div className="absolute right-6 top-6 z-10">
        <ModeToggle />
      </div>

      <div className="relative z-10 grid w-full max-w-7xl gap-6 xl:grid-cols-[1.15fr_0.85fr] xl:items-stretch">
        <Card className="border-none bg-transparent shadow-none">
          <CardContent className="flex h-full flex-col justify-between rounded-[1.75rem] border bg-card/75 p-6 shadow-soft backdrop-blur sm:p-8 xl:p-10">
              <div className="space-y-8">
              <div className="space-y-5">
                <Badge variant="outline" className="rounded-full px-4 py-1.5">
                  SmartQuery Workspace
                </Badge>

                <div className="flex items-start gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                    <Database className="h-6 w-6" />
                  </div>
                  <div className="space-y-3">
                    <h1 className="max-w-2xl font-display text-4xl font-extrabold tracking-tight sm:text-5xl xl:text-6xl">
                      Query your database like a product, not a prototype.
                    </h1>
                    <p className="max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
                      A polished text-to-SQL workspace for schema exploration, generated SQL review, result inspection, and
                      engineering storytelling from one focused interface.
                    </p>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  {HIGHLIGHTS.map((item) => (
                    <div key={item.label} className="rounded-xl border bg-background/75 p-4">
                      <div className="font-display text-2xl font-extrabold tracking-tight">{item.value}</div>
                      <div className="mt-1 text-xs uppercase tracking-[0.14em] text-muted-foreground">{item.label}</div>
                    </div>
                  ))}
                </div>

                <div className="grid gap-3">
                  {FEATURES.map((feature) => (
                    <div key={feature} className="flex items-start gap-3 rounded-xl border bg-background/80 p-4">
                      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary">
                        <ShieldCheck className="h-4 w-4" />
                      </div>
                      <span className="text-sm leading-6 text-muted-foreground">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[1.5rem] border bg-card/95 shadow-soft backdrop-blur xl:max-w-[30rem] xl:justify-self-end">
          <CardContent className="p-6 sm:p-7">
            <Tabs value={tab} onValueChange={setTab} className="w-full">
              <div className="mb-6 flex items-start justify-between gap-4">
                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Authentication</div>
                  <CardTitle className="text-2xl">{tab === 'login' ? 'Welcome back' : 'Create your account'}</CardTitle>
                  <CardDescription className="mt-2 max-w-sm text-sm leading-6">
                    {tab === 'login'
                      ? 'Sign in to enter the dashboard, connect data, and run SQL workflows.'
                      : 'Create a local account to start using the SmartQuery workspace.'}
                  </CardDescription>
                </div>
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-secondary">
                  {tab === 'login' ? <Lock className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
                </div>
              </div>

              <TabsList className="mb-6 grid w-full grid-cols-2 rounded-lg bg-muted/70 p-1">
                <TabsTrigger value="login">Sign In</TabsTrigger>
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
              </TabsList>

              <TabsContent value="login" className="mt-0" />
              <TabsContent value="signup" className="mt-0" />
            </Tabs>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input id="username" value={form.username} onChange={set('username')} required placeholder="demo_user" className="h-11" />
              </div>

              {tab === 'signup' && (
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={form.email} onChange={set('email')} placeholder="you@example.com" className="h-11" />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" value={form.password} onChange={set('password')} required placeholder="Enter password" className="h-11" />
                {tab === 'signup' && <div className="text-xs text-muted-foreground">Use at least 8 characters with upper/lowercase letters and a number.</div>}
              </div>

              <Button type="submit" className="mt-2 w-full rounded-lg" size="lg" disabled={loading}>
                {loading ? 'Processing...' : tab === 'login' ? 'Enter workspace' : 'Create account'}
                {!loading && <ArrowRight className="h-4 w-4" />}
              </Button>
            </form>

            <div className="mt-6 rounded-lg border bg-muted/40 p-4 text-sm leading-6 text-muted-foreground">
              Runs locally with your backend and Ollama setup. Theme and session state persist across reloads.
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
              <div className="rounded-lg border bg-background/70 p-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Zap className="h-4 w-4 text-primary" />
                  <span>Connect</span>
                </div>
                <div className="mt-2 text-sm leading-6 text-muted-foreground">Attach SQLite, MySQL, PostgreSQL, or CSV data in one flow.</div>
              </div>
              <div className="rounded-lg border bg-background/70 p-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Zap className="h-4 w-4 text-primary" />
                  <span>Query</span>
                </div>
                <div className="mt-2 text-sm leading-6 text-muted-foreground">Turn natural language questions into schema-aware SQL.</div>
              </div>
              <div className="rounded-lg border bg-background/70 p-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Zap className="h-4 w-4 text-primary" />
                  <span>Explain</span>
                </div>
                <div className="mt-2 text-sm leading-6 text-muted-foreground">Inspect results, execution details, and charts with context.</div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
              <Badge variant="outline" className="rounded-full px-3 py-1">JWT auth</Badge>
              <Badge variant="outline" className="rounded-full px-3 py-1">Rate limited</Badge>
              <Badge variant="outline" className="rounded-full px-3 py-1">Persistent theme</Badge>
              <Badge variant="outline" className="rounded-full px-3 py-1">Offline-ready</Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
