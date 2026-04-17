import { useRef, useEffect, useState } from 'react'
import { ArrowUp, Check, Copy, Database, Sparkles, Trash2 } from 'lucide-react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneLight, vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { useTheme } from 'next-themes'
import toast from 'react-hot-toast'
import { useQueryStore } from '../../stores/queryStore'
import api from '../../utils/api'
import ResultPanel from './ResultPanel'
import { formatApiError } from '../../utils/errors'
import { Button } from '../ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Badge } from '../ui/badge'
import { ScrollArea } from '../ui/scroll-area'
import { Textarea } from '../ui/textarea'
import { Separator } from '../ui/separator'
import chatIllustration from '../../assets/chat-illustration.svg'

const DEFAULT_SUGGESTIONS = [
  'Show top 10 students by CGPA',
  'Count students by department',
  'Average marks by course',
  'Show total sales by region',
]

export default function ChatPage() {
  const { theme, systemTheme } = useTheme()
  const { messages, loading, connected, suggestedQuestions, addMessage, setLoading, clearChat } = useQueryStore()
  const [input, setInput] = useState('')
  const [copiedIndex, setCopiedIndex] = useState(null)
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const starterPrompts = suggestedQuestions?.length ? suggestedQuestions : DEFAULT_SUGGESTIONS
  const resolvedTheme = theme === 'system' ? systemTheme : theme
  const syntaxTheme = resolvedTheme === 'dark' ? vscDarkPlus : oneLight

  const sendMessage = async (question) => {
    if (!question.trim() || loading) return
    if (!connected) {
      toast.error('Please connect a database first in Connect DB.')
      return
    }

    const currentQuestion = question.trim()
    addMessage({ role: 'user', content: currentQuestion })
    setInput('')
    setLoading(true)

    const history = messages
      .slice(-6)
      .map((message) => ({ role: message.role === 'user' ? 'user' : 'assistant', content: message.content || message.sql || '' }))

    try {
      const { data } = await api.post('/query/run', { question: currentQuestion, conversation_history: history })
      addMessage({
        role: 'assistant',
        content: data.error ? `Error: ${data.error}` : null,
        sql: data.sql,
        columns: data.columns,
        rows: data.rows,
        rowCount: data.row_count,
        executionMs: data.execution_time_ms,
        wasCorrected: data.was_corrected,
        fromCache: data.from_cache,
        explanation: data.explanation,
        insights: data.insights,
        sqlAnalysis: data.sql_analysis,
        isError: !!data.error,
      })
    } catch (error) {
      const message = formatApiError(error, 'Query failed')
      addMessage({ role: 'assistant', content: `Error: ${message}`, isError: true })
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  const handleKey = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      sendMessage(input)
    }
  }

  const handleCopySql = async (sql, index) => {
    try {
      await navigator.clipboard.writeText(sql)
      setCopiedIndex(index)
      toast.success('SQL copied')
      window.setTimeout(() => {
        setCopiedIndex((current) => (current === index ? null : current))
      }, 2000)
    } catch (error) {
      toast.error('Copy failed')
    }
  }

  return (
    <div className="grid min-h-[calc(100vh-11rem)] gap-4 lg:grid-cols-[minmax(0,1fr)_24rem]">
      <Card className="overflow-hidden rounded-[1.75rem]">
        <CardHeader className="space-y-4 border-b bg-card/60">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="text-xl">Query Session</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">{messages.length} messages in the current analytical conversation</p>
            </div>
            <Button variant="outline" className="rounded-2xl" onClick={clearChat}>
              <Trash2 className="h-4 w-4" />
              Clear chat
            </Button>
          </div>

          {!connected && (
            <div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
              Connect a database first to enable query generation and execution.
            </div>
          )}
        </CardHeader>

        <CardContent className="flex h-[calc(100vh-18rem)] flex-col p-0">
          <ScrollArea className="flex-1">
            <div className="space-y-4 p-4 sm:p-6">
              {messages.length === 0 ? (
                <div className="flex min-h-[24rem] flex-col items-center justify-center gap-5 rounded-[1.5rem] border border-dashed bg-muted/30 px-6 py-12 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-secondary">
                    <Sparkles className="h-7 w-7" />
                  </div>
                  <div className="space-y-2">
                    <h2 className="font-display text-2xl font-bold tracking-tight">Ask questions about your data</h2>
                    <p className="mx-auto max-w-xl text-sm leading-6 text-muted-foreground">
                      SmartQuery translates natural language to SQL, executes the query, explains the output, and surfaces query
                      complexity signals in one workflow.
                    </p>
                  </div>
                  <div className="w-full max-w-3xl overflow-hidden rounded-[1.5rem] border bg-background/80 p-3 shadow-sm">
                    <img src={chatIllustration} alt="Text to SQL query flow illustration" className="h-auto w-full rounded-[1rem]" />
                  </div>
                  {connected && (
                    <div className="flex max-w-3xl flex-wrap justify-center gap-2">
                      {starterPrompts.map((suggestion) => (
                        <Button key={suggestion} variant="outline" className="rounded-full" onClick={() => sendMessage(suggestion)}>
                          {suggestion}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                messages.map((message, index) => (
                  <div key={index} className="space-y-3">
                    {message.role === 'user' ? (
                      <div className="flex justify-end">
                        <div className="max-w-3xl rounded-[1.5rem] rounded-br-md bg-primary px-4 py-3 text-sm text-primary-foreground shadow-sm">
                          {message.content}
                        </div>
                      </div>
                    ) : (
                      <Card className="rounded-[1.5rem] border bg-card/95">
                        <CardContent className="space-y-4 p-5">
                          {message.isError ? (
                            <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
                              {message.content}
                            </div>
                          ) : (
                            <>
                              {message.sql && (
                                <div className="space-y-3">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div className="text-sm font-semibold">Generated SQL</div>
                                    <div className="flex flex-wrap items-center gap-2">
                                      {message.wasCorrected && <Badge variant="secondary">Auto-corrected</Badge>}
                                      {message.fromCache && <Badge variant="outline">Cached</Badge>}
                                      {message.sqlAnalysis && <Badge variant="outline">{message.sqlAnalysis.complexity_label}</Badge>}
                                      <Button variant="outline" size="sm" className="rounded-full" onClick={() => handleCopySql(message.sql, index)}>
                                        {copiedIndex === index ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                                        {copiedIndex === index ? 'Copied' : 'Copy SQL'}
                                      </Button>
                                    </div>
                                  </div>
                                  <SyntaxHighlighter
                                    language="sql"
                                    style={syntaxTheme}
                                    customStyle={{
                                      borderRadius: '18px',
                                      margin: 0,
                                      border: '1px solid hsl(var(--border))',
                                      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
                                    }}
                                  >
                                    {message.sql}
                                  </SyntaxHighlighter>
                                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                                    <Badge variant="outline">{message.executionMs} ms</Badge>
                                    <Badge variant="outline">{message.rowCount} rows</Badge>
                                    {message.sqlAnalysis?.tables?.length > 0 && (
                                      <Badge variant="outline">{message.sqlAnalysis.tables.join(', ')}</Badge>
                                    )}
                                  </div>
                                </div>
                              )}

                              {message.rows && (
                                <>
                                  <Separator />
                                  <ResultPanel
                                    columns={message.columns}
                                    rows={message.rows}
                                    explanation={message.explanation}
                                    insights={message.insights}
                                    sqlAnalysis={message.sqlAnalysis}
                                  />
                                </>
                              )}
                            </>
                          )}
                        </CardContent>
                      </Card>
                    )}
                  </div>
                ))
              )}

              {loading && (
                <Card className="rounded-[1.5rem] border bg-card/95">
                  <CardContent className="flex items-center gap-3 p-5 text-sm text-muted-foreground">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted border-t-foreground" />
                    SmartQuery is generating and validating SQL...
                  </CardContent>
                </Card>
              )}
              <div ref={bottomRef} />
            </div>
          </ScrollArea>

          <Separator />

          <div className="space-y-3 p-4 sm:p-5">
            <Textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleKey}
              placeholder={connected ? 'Ask a question about your data...' : 'Connect a database first...'}
              disabled={!connected || loading}
              rows={3}
              className="min-h-[92px] rounded-[1.5rem] bg-background"
            />
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">Press Enter to send. Use Shift+Enter for a new line.</p>
              <Button className="rounded-2xl" onClick={() => sendMessage(input)} disabled={loading || !connected}>
                <ArrowUp className="h-4 w-4" />
                Send
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card className="rounded-[1.75rem]">
          <CardHeader>
            <CardTitle className="text-lg">Workspace status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4" />
              {connected ? 'Database connected and ready for queries' : 'No active source'}
            </div>
            <div className="rounded-2xl border bg-muted/40 p-4">
              The chat view is now theme-aware, uses shared UI primitives, and follows the same light/dark token system as the rest of the app.
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[1.75rem]">
          <CardHeader>
            <CardTitle className="text-lg">Suggested prompts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {starterPrompts.map((prompt) => (
              <button
                key={prompt}
                className="w-full rounded-2xl border px-4 py-3 text-left text-sm transition-colors hover:bg-accent"
                onClick={() => sendMessage(prompt)}
                disabled={!connected}
              >
                {prompt}
              </button>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
