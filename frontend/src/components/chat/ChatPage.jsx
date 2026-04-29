import { useEffect, useRef, useState } from 'react'
import {
  ArrowUp,
  BookmarkPlus,
  Check,
  Code2,
  Copy,
  Database,
  Eye,
  Play,
  Search,
  Sparkles,
  Table2,
  Trash2,
  X,
} from 'lucide-react'
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

const ROW_LIMITS = [10, 50, 100, 500, 1000]

function formatTimestamp(iso) {
  if (!iso) return 'Not run yet'
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function ChatPage() {
  const { theme, systemTheme } = useTheme()
  const {
    messages,
    loading,
    connected,
    suggestedQuestions,
    schemaTree,
    schemaProfile,
    savedQueries,
    addMessage,
    setLoading,
    clearChat,
    saveQuery,
    removeSavedQuery,
    markSavedQueryRun,
  } = useQueryStore()
  const [input, setInput] = useState('')
  const [rowLimit, setRowLimit] = useState(100)
  const [copiedIndex, setCopiedIndex] = useState(null)
  const [sqlDrafts, setSqlDrafts] = useState({})
  const [schemaSearch, setSchemaSearch] = useState('')
  const [savedSearch, setSavedSearch] = useState('')
  const [selectedTable, setSelectedTable] = useState('')
  const [tablePreviews, setTablePreviews] = useState({})
  const [previewLoading, setPreviewLoading] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const starterPrompts = suggestedQuestions?.length ? suggestedQuestions : DEFAULT_SUGGESTIONS
  const resolvedTheme = theme === 'system' ? systemTheme : theme
  const syntaxTheme = resolvedTheme === 'dark' ? vscDarkPlus : oneLight
  const schemaEntries = Object.entries(schemaTree || {})
  const visibleSchemaEntries = schemaEntries.filter(([table, cols]) => {
    const q = schemaSearch.toLowerCase().trim()
    if (!q) return true
    return table.toLowerCase().includes(q) || cols.some((col) => String(col).toLowerCase().includes(q))
  })
  const visibleSavedQueries = savedQueries.filter((item) => {
    const q = savedSearch.toLowerCase().trim()
    if (!q) return true
    return (
      item.name.toLowerCase().includes(q) ||
      item.question.toLowerCase().includes(q) ||
      item.sql.toLowerCase().includes(q)
    )
  })
  const selectedTableProfile = schemaProfile?.tables?.find((table) => table.name === selectedTable)
  const selectedTablePreview = selectedTable ? tablePreviews[selectedTable] : null

  useEffect(() => {
    if (!connected || schemaEntries.length === 0) {
      setSelectedTable('')
      return
    }

    if (!selectedTable || !schemaTree[selectedTable]) {
      setSelectedTable(schemaEntries[0]?.[0] || '')
    }
  }, [connected, schemaEntries.length, schemaTree, selectedTable])

  useEffect(() => {
    if (!connected || schemaEntries.length === 0) {
      setTablePreviews({})
      setPreviewLoading(false)
      return
    }

    let cancelled = false
    setPreviewLoading(true)

    api.get('/query/table-previews?limit=5')
      .then(({ data }) => {
        if (!cancelled) {
          setTablePreviews(data.previews || {})
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTablePreviews({})
        }
      })
      .finally(() => {
        if (!cancelled) {
          setPreviewLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [connected, schemaEntries.length])

  const addAssistantResult = (data) => {
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
      rawSql: data.raw_sql,
      explanation: data.explanation,
      insights: data.insights,
      sqlAnalysis: data.sql_analysis,
      isError: !!data.error,
    })
  }

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
      const { data } = await api.post('/query/run', {
        question: currentQuestion,
        conversation_history: history,
        row_limit: rowLimit,
      })
      addAssistantResult(data)
    } catch (error) {
      const message = formatApiError(error, 'Query failed')
      addMessage({ role: 'assistant', content: `Error: ${message}`, isError: true })
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  const runEditedSql = async (index, originalQuestion, sqlOverride = null, savedQueryId = null) => {
    const sql = sqlOverride ?? sqlDrafts[index]
    if (!sql?.trim() || loading) return
    if (!connected) {
      toast.error('Please connect a database first in Connect DB.')
      return
    }

    addMessage({ role: 'user', content: `Run edited SQL${originalQuestion ? ` for: ${originalQuestion}` : ''}` })
    setLoading(true)
    try {
      const { data } = await api.post('/query/execute-raw', {
        sql,
        question: originalQuestion || 'Edited SQL execution',
        row_limit: rowLimit,
      })
      addAssistantResult(data)
      if (savedQueryId) markSavedQueryRun(savedQueryId)
      setSqlDrafts((current) => {
        const next = { ...current }
        delete next[index]
        return next
      })
    } catch (error) {
      const message = formatApiError(error, 'Edited SQL failed')
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
      window.setTimeout(() => setCopiedIndex((current) => (current === index ? null : current)), 2000)
    } catch (_) {
      toast.error('Copy failed')
    }
  }

  const handleSaveQuery = (question, sql) => {
    const name = window.prompt('Saved query name', question || 'Saved Query')
    if (!name) return
    saveQuery({ name, question, sql })
    toast.success('Saved to query library')
  }

  const activeQueryCount = messages.filter((message) => message.role === 'assistant' && message.sql).length

  return (
    <div className="grid h-[calc(100vh-11rem)] min-h-0 gap-4 overflow-hidden lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] xl:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] 2xl:grid-cols-[minmax(0,1fr)_28rem]">
      <Card className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-[1.75rem]">
        <CardHeader className="space-y-4 border-b bg-card/60">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="text-xl">Advanced Text-to-SQL Session</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">Ask, edit SQL, rerun, export, save, and inspect results in one workspace.</p>
            </div>
            <Button variant="outline" className="rounded-2xl" onClick={clearChat}>
              <Trash2 className="h-4 w-4" />
              Clear chat
            </Button>
          </div>

          {!connected && <div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">Connect a database first to enable query generation and execution.</div>}
        </CardHeader>

        <CardContent className="flex min-h-0 flex-1 flex-col p-0">
          <ScrollArea className="flex-1">
            <div className="space-y-4 p-4 sm:p-6">
              {messages.length === 0 ? (
                <div className="flex min-h-[calc(100vh-31rem)] flex-col items-center justify-center gap-5 rounded-[1.5rem] border border-dashed bg-muted/30 px-6 py-12 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-secondary"><Sparkles className="h-7 w-7" /></div>
                  <div className="space-y-2">
                    <h2 className="font-display text-2xl font-bold tracking-tight">Ask questions about your data</h2>
                    <p className="mx-auto max-w-xl text-sm leading-6 text-muted-foreground">SmartQuery translates natural language to SQL, lets you edit the generated SQL, executes safely, and keeps a reusable query library for repeated analysis.</p>
                  </div>
                  <div className="w-full max-w-3xl overflow-hidden rounded-[1.5rem] border bg-background/80 p-3 shadow-sm">
                    <img src={chatIllustration} alt="Text to SQL query flow illustration" className="h-auto w-full rounded-[1rem]" />
                  </div>
                  {connected && <div className="flex max-w-3xl flex-wrap justify-center gap-2">{starterPrompts.map((suggestion) => <Button key={suggestion} variant="outline" className="rounded-full" onClick={() => sendMessage(suggestion)}>{suggestion}</Button>)}</div>}
                </div>
              ) : (
                messages.map((message, index) => {
                  const previousQuestion = messages[index - 1]?.role === 'user' ? messages[index - 1].content : ''
                  const isEditing = Object.prototype.hasOwnProperty.call(sqlDrafts, index)
                  return (
                    <div key={index} className="space-y-3">
                      {message.role === 'user' ? (
                        <div className="flex justify-end"><div className="max-w-3xl rounded-[1.5rem] rounded-br-md bg-primary px-4 py-3 text-sm text-primary-foreground shadow-sm">{message.content}</div></div>
                      ) : (
                        <Card className="rounded-[1.5rem] border bg-card/95">
                          <CardContent className="space-y-4 p-5">
                            {message.isError ? <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{message.content}</div> : (
                              <>
                                {message.sql && (
                                  <div className="space-y-3">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                      <div className="text-sm font-semibold">{message.rawSql ? 'SQL Editor Result' : 'Generated SQL'}</div>
                                      <div className="flex flex-wrap items-center gap-2">
                                        {message.wasCorrected && <Badge variant="secondary">Auto-corrected</Badge>}
                                        {message.fromCache && <Badge variant="outline">Cached</Badge>}
                                        {message.rawSql && <Badge variant="outline">Edited SQL</Badge>}
                                        {message.sqlAnalysis && <Badge variant="outline">{message.sqlAnalysis.complexity_label}</Badge>}
                                        <Button variant="outline" size="sm" className="rounded-full" onClick={() => setSqlDrafts((current) => ({ ...current, [index]: message.sql }))}>
                                          <Code2 className="h-4 w-4" /> Edit SQL
                                        </Button>
                                        <Button variant="outline" size="sm" className="rounded-full" onClick={() => handleSaveQuery(previousQuestion, message.sql)}>
                                          <BookmarkPlus className="h-4 w-4" /> Save Query
                                        </Button>
                                        <Button variant="outline" size="sm" className="rounded-full" onClick={() => handleCopySql(message.sql, index)}>
                                          {copiedIndex === index ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                                          {copiedIndex === index ? 'Copied' : 'Copy SQL'}
                                        </Button>
                                      </div>
                                    </div>

                                    {isEditing ? (
                                      <div className="space-y-3 rounded-2xl border bg-muted/30 p-3">
                                        <Textarea value={sqlDrafts[index]} onChange={(event) => setSqlDrafts((current) => ({ ...current, [index]: event.target.value }))} rows={7} className="font-mono text-sm" />
                                        <div className="flex flex-wrap justify-end gap-2">
                                          <Button variant="outline" size="sm" className="rounded-full" onClick={() => setSqlDrafts((current) => { const next = { ...current }; delete next[index]; return next })}><X className="h-4 w-4" /> Cancel</Button>
                                          <Button size="sm" className="rounded-full" onClick={() => runEditedSql(index, previousQuestion)} disabled={loading}><Play className="h-4 w-4" /> Run edited SQL</Button>
                                        </div>
                                      </div>
                                    ) : (
                                      <SyntaxHighlighter language="sql" style={syntaxTheme} customStyle={{ borderRadius: '18px', margin: 0, border: '1px solid hsl(var(--border))', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)' }}>{message.sql}</SyntaxHighlighter>
                                    )}

                                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                                      <Badge variant="outline">{message.executionMs} ms</Badge>
                                      <Badge variant="outline">{message.rowCount} rows</Badge>
                                      {message.sqlAnalysis?.tables?.length > 0 && <Badge variant="outline">{message.sqlAnalysis.tables.join(', ')}</Badge>}
                                    </div>
                                  </div>
                                )}

                                {message.rows && <><Separator /><ResultPanel columns={message.columns} rows={message.rows} explanation={message.explanation} insights={message.insights} sqlAnalysis={message.sqlAnalysis} /></>}
                              </>
                            )}
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  )
                })
              )}

              {loading && <Card className="rounded-[1.5rem] border bg-card/95"><CardContent className="flex items-center gap-3 p-5 text-sm text-muted-foreground"><div className="h-4 w-4 animate-spin rounded-full border-2 border-muted border-t-foreground" />SmartQuery is generating, validating, or executing SQL...</CardContent></Card>}
              <div ref={bottomRef} />
            </div>
          </ScrollArea>

          <Separator />

          <div className="space-y-3 p-4 sm:p-5">
            <Textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={handleKey} placeholder={connected ? 'Ask a question about your data...' : 'Connect a database first...'} disabled={!connected || loading} rows={3} className="min-h-[92px] rounded-[1.5rem] bg-background" />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>Press Enter to send. Shift+Enter for a new line.</span>
                <label className="flex items-center gap-2 rounded-full border px-3 py-2">
                  Row limit
                  <select value={rowLimit} onChange={(event) => setRowLimit(Number(event.target.value))} className="bg-transparent text-foreground outline-none">
                    {ROW_LIMITS.map((limit) => <option key={limit} value={limit}>{limit}</option>)}
                  </select>
                </label>
              </div>
              <Button className="rounded-2xl" onClick={() => sendMessage(input)} disabled={loading || !connected}><ArrowUp className="h-4 w-4" />Send</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="min-h-0 min-w-0 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="space-y-4 pr-3">
            <Card className="rounded-[1.75rem]">
              <CardHeader><CardTitle className="text-lg">Workspace status</CardTitle></CardHeader>
              <CardContent className="space-y-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2"><Database className="h-4 w-4" />{connected ? 'Database connected and ready for advanced queries' : 'No active source'}</div>
                {schemaProfile?.overview && (
                    <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
                      <div className="min-w-0 rounded-2xl border p-3"><div className="text-lg font-bold text-foreground">{schemaProfile.overview.table_count}</div><div className="text-xs">Tables</div></div>
                      <div className="min-w-0 rounded-2xl border p-3"><div className="text-lg font-bold text-foreground">{schemaProfile.overview.total_columns}</div><div className="text-xs">Columns</div></div>
                      <div className="min-w-0 rounded-2xl border p-3"><div className="text-lg font-bold text-foreground">{schemaProfile.overview.relationship_count}</div><div className="text-xs">Relations</div></div>
                      <div className="min-w-0 rounded-2xl border p-3"><div className="text-lg font-bold text-foreground">{activeQueryCount}</div><div className="text-xs">Runs</div></div>
                    </div>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-[1.75rem]">
              <CardHeader><CardTitle className="text-lg">Saved query library</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input value={savedSearch} onChange={(event) => setSavedSearch(event.target.value)} placeholder="Search saved queries..." className="w-full rounded-2xl border bg-background py-2 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-ring" />
                </div>
                {savedQueries.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Save generated SQL here to build a reusable query library for repeated analysis and demos.</p>
                ) : visibleSavedQueries.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No saved queries match your search.</p>
                ) : (
                  <div className="space-y-2">
                    {visibleSavedQueries.map((savedQuery) => (
                      <div key={savedQuery.id} className="rounded-2xl border p-3">
                        <div className="mb-2 flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium">{savedQuery.name}</div>
                            <div className="line-clamp-2 text-xs text-muted-foreground">{savedQuery.question || 'Saved SQL query'}</div>
                          </div>
                          <button className="text-muted-foreground hover:text-destructive" onClick={() => removeSavedQuery(savedQuery.id)}>
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      <div className="mb-3 overflow-hidden rounded-xl border bg-muted/25 px-3 py-2 font-mono text-[11px] text-muted-foreground break-all">
                        {savedQuery.sql}
                      </div>
                        <div className="mb-3 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                          <Badge variant="outline">Saved {formatTimestamp(savedQuery.createdAt)}</Badge>
                          <Badge variant="outline">Last run {formatTimestamp(savedQuery.lastRunAt)}</Badge>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button variant="outline" size="sm" className="rounded-full" onClick={() => setInput(savedQuery.question || '')} disabled={!connected || !savedQuery.question}>
                            Use prompt
                          </Button>
                          <Button variant="outline" size="sm" className="rounded-full" onClick={() => runEditedSql(null, savedQuery.question, savedQuery.sql, savedQuery.id)} disabled={!connected}>
                            <Play className="h-4 w-4" /> Run SQL
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-[1.75rem]">
              <CardHeader><CardTitle className="text-lg">Live data explorer</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input value={schemaSearch} onChange={(event) => setSchemaSearch(event.target.value)} placeholder="Search table or column..." className="w-full rounded-2xl border bg-background py-2 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-ring" />
                </div>

                <ScrollArea className="h-52 rounded-2xl border">
                  <div className="space-y-3 p-3">
                    {!connected ? (
                      <p className="text-sm text-muted-foreground">Connect a database to browse live tables and columns.</p>
                    ) : visibleSchemaEntries.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No matching schema items.</p>
                    ) : (
                      visibleSchemaEntries.map(([table, columns]) => {
                        const profile = schemaProfile?.tables?.find((item) => item.name === table)
                        const isSelected = selectedTable === table
                        return (
                          <button key={table} type="button" className={`w-full min-w-0 rounded-2xl border p-3 text-left transition-colors ${isSelected ? 'border-primary bg-primary/5' : 'bg-muted/35 hover:bg-muted/55'}`} onClick={() => setSelectedTable(table)}>
                            <div className="mb-2 flex items-center justify-between gap-2">
                              <div className="min-w-0 break-all font-mono text-sm font-semibold">{table}</div>
                              <Badge variant="outline">{columns.length}</Badge>
                            </div>
                            <div className="mb-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                              <span>{profile?.row_count ?? 'Unknown'} rows</span>
                              <span>{profile?.foreign_key_count ?? 0} foreign keys</span>
                              <span>{profile?.numeric_columns?.length ?? 0} numeric</span>
                            </div>
                            <div className="line-clamp-2 space-y-1">
                              {columns.slice(0, 3).map((column) => <div key={column} className="break-all rounded-lg bg-background/70 px-2 py-1 font-mono text-xs text-muted-foreground">{column}</div>)}
                            </div>
                          </button>
                        )
                      })
                    )}
                  </div>
                </ScrollArea>

                <div className="rounded-[1.5rem] border bg-muted/20 p-4">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 text-sm font-semibold">
                        <Table2 className="h-4 w-4" />
                        {selectedTable || 'Select a table'}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {selectedTableProfile
                          ? `${selectedTableProfile.column_count} columns, ${selectedTableProfile.row_count ?? 'Unknown'} rows`
                          : 'Choose a table to inspect a sample preview.'}
                      </div>
                    </div>
                    {selectedTablePreview?.rows?.length > 0 && <Badge variant="secondary"><Eye className="mr-1 h-3 w-3" />5-row preview</Badge>}
                  </div>

                  {selectedTableProfile?.numeric_columns?.length > 0 && (
                    <div className="mb-3 flex flex-wrap gap-2">
                      {selectedTableProfile.numeric_columns.slice(0, 4).map((column) => (
                        <Badge key={column} variant="outline" className="max-w-full break-all whitespace-normal">{column}</Badge>
                      ))}
                    </div>
                  )}

                  {previewLoading && !selectedTablePreview ? (
                    <div className="rounded-2xl border bg-background/70 px-4 py-3 text-sm text-muted-foreground">Loading preview...</div>
                  ) : selectedTablePreview?.rows?.length > 0 ? (
                    <div className="max-w-full overflow-x-auto rounded-2xl border bg-background">
                      <table className="min-w-full text-left text-xs">
                        <thead className="bg-muted/45">
                          <tr>
                            {selectedTablePreview.columns.map((column) => (
                              <th key={column} className="px-3 py-2 font-semibold text-muted-foreground break-all">{column}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {selectedTablePreview.rows.map((row, rowIndex) => (
                            <tr key={`${selectedTable}-${rowIndex}`} className="border-t">
                              {selectedTablePreview.columns.map((column) => (
                                <td key={`${selectedTable}-${rowIndex}-${column}`} className="max-w-[220px] break-all px-3 py-2 font-mono">
                                  {row[column] === null || row[column] === undefined ? 'null' : String(row[column])}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="rounded-2xl border bg-background/70 px-4 py-3 text-sm text-muted-foreground">No preview rows available for this table.</div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-[1.75rem]">
              <CardHeader><CardTitle className="text-lg">Suggested prompts</CardTitle></CardHeader>
              <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                {starterPrompts.map((prompt) => (
                  <button key={prompt} className="w-full rounded-2xl border px-4 py-3 text-left text-sm transition-colors hover:bg-accent" onClick={() => sendMessage(prompt)} disabled={!connected}>
                    {prompt}
                  </button>
                ))}
              </CardContent>
            </Card>
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}
