import { useEffect, useRef, useState } from 'react'
import { Database, FileSpreadsheet, UploadCloud } from 'lucide-react'
import toast from 'react-hot-toast'
import { useQueryStore } from '../../stores/queryStore'
import api from '../../utils/api'
import { formatApiError } from '../../utils/errors'
import { Button } from '../ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Badge } from '../ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import connectIllustration from '../../assets/connect-illustration.svg'

export default function ConnectPage() {
  const { connected, schemaTree, schemaProfile, suggestedQuestions, setConnected, disconnect } = useQueryStore()
  const [dbType, setDbType] = useState('SQLite')
  const [form, setForm] = useState({
    sqlite_path: 'D:/text2sql-app/backend/project_data.db',
    host: 'localhost',
    port: '',
    database: '',
    user: '',
    password: '',
  })
  const [loading, setLoading] = useState(false)
  const [csvFile, setCsvFile] = useState(null)
  const [tableName, setTableName] = useState('uploaded_data')
  const [csvLoading, setCsvLoading] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [tablePreviews, setTablePreviews] = useState({})
  const [previewLoading, setPreviewLoading] = useState(false)
  const fileRef = useRef(null)

  const setField = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }))

  const handleConnect = async () => {
    setLoading(true)
    try {
      let payload = { db_type: dbType }
      if (dbType === 'SQLite') {
        payload.sqlite_path = form.sqlite_path
      } else {
        payload = {
          ...payload,
          host: form.host || 'localhost',
          database: form.database || null,
          user: form.user || null,
          password: form.password || null,
        }

        if (form.port !== '' && form.port !== null && form.port !== undefined) {
          const parsedPort = Number(form.port)
          if (!Number.isNaN(parsedPort)) payload.port = parsedPort
        }
      }

      const { data } = await api.post('/query/connect', payload)
      setConnected(dbType, data.schema_text, data.schema_tree, data.schema_profile, data.suggested_questions)
      toast.success(`Connected to ${dbType}`)
    } catch (error) {
      toast.error(formatApiError(error, 'Connection failed'))
    } finally {
      setLoading(false)
    }
  }

  const handleDisconnect = () => {
    disconnect()
    setTablePreviews({})
    toast.success('Disconnected')
  }

  const handleCsvUpload = async () => {
    if (!csvFile) return
    setCsvLoading(true)
    const formData = new FormData()
    formData.append('file', csvFile)
    formData.append('table_name', tableName)
    try {
      const { data } = await api.post('/upload/csv', formData)
      toast.success(`${data.message} - ${data.rows} rows`)
      setCsvFile(null)
      const { data: schemaData } = await api.get('/query/schema')
      setConnected(dbType, schemaData.schema_text, schemaData.schema_tree, schemaData.schema_profile, schemaData.suggested_questions)
    } catch (error) {
      toast.error(formatApiError(error, 'Upload failed'))
    } finally {
      setCsvLoading(false)
    }
  }

  const stats = schemaProfile?.overview
  const tableEntries = Object.entries(schemaTree || {})

  useEffect(() => {
    if (!connected || tableEntries.length === 0) {
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
  }, [connected, tableEntries.length])

  return (
    <div className="space-y-4">
      {connected && (
        <Card className="rounded-[1.75rem] border">
          <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-sm font-semibold">Database connected</div>
              <p className="text-sm text-muted-foreground">
                {tableEntries.length} tables loaded with schema profiling and starter prompts ready.
              </p>
            </div>
            <Button variant="outline" className="rounded-2xl" onClick={handleDisconnect}>
              Disconnect
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="rounded-[1.75rem]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Database className="h-5 w-5" />
              Database Connection
            </CardTitle>
            <CardDescription>Configure SQLite, MySQL, or PostgreSQL and hydrate the schema intelligence layer.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label>Database type</Label>
              <Select value={dbType} onValueChange={setDbType}>
                <SelectTrigger className="rounded-2xl">
                  <SelectValue placeholder="Select database type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SQLite">SQLite</SelectItem>
                  <SelectItem value="MySQL">MySQL</SelectItem>
                  <SelectItem value="PostgreSQL">PostgreSQL</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {dbType === 'SQLite' ? (
              <div className="space-y-2">
                <Label htmlFor="sqlite-path">SQLite path</Label>
                <Input id="sqlite-path" value={form.sqlite_path} onChange={setField('sqlite_path')} placeholder="D:/path/to/database.db" />
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="host">Host</Label>
                  <Input id="host" value={form.host} onChange={setField('host')} placeholder="localhost" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="port">Port</Label>
                  <Input id="port" value={form.port} onChange={setField('port')} placeholder={dbType === 'MySQL' ? '3306' : '5432'} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="database">Database</Label>
                  <Input id="database" value={form.database} onChange={setField('database')} placeholder="project_db" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="user">Username</Label>
                  <Input id="user" value={form.user} onChange={setField('user')} placeholder="root" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input id="password" type="password" value={form.password} onChange={setField('password')} placeholder="Enter password" />
                </div>
              </div>
            )}

            <Button className="w-full rounded-2xl" size="lg" onClick={handleConnect} disabled={loading}>
              {loading ? 'Connecting...' : 'Connect Database'}
            </Button>
          </CardContent>
        </Card>

        <Card className="rounded-[1.75rem]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <FileSpreadsheet className="h-5 w-5" />
              CSV Import
            </CardTitle>
            <CardDescription>Upload a CSV file and register it as a queryable table in the active SQLite workspace.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <button
              type="button"
              className={`flex min-h-[11rem] w-full flex-col items-center justify-center gap-3 rounded-[1.5rem] border-2 border-dashed px-6 text-center transition-colors ${
                dragActive ? 'border-primary bg-primary/5' : 'border-border bg-muted/30 hover:bg-muted/50'
              }`}
              onClick={() => fileRef.current?.click()}
              onDragOver={(event) => {
                event.preventDefault()
                setDragActive(true)
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={(event) => {
                event.preventDefault()
                setDragActive(false)
                const file = event.dataTransfer.files[0]
                if (file?.name.endsWith('.csv')) setCsvFile(file)
              }}
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary">
                <UploadCloud className="h-6 w-6" />
              </div>
              <div>
                <div className="text-sm font-semibold">{csvFile ? csvFile.name : 'Drop CSV here or click to browse'}</div>
                <div className="text-xs text-muted-foreground">Only CSV files are accepted</div>
              </div>
              <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={(event) => setCsvFile(event.target.files[0])} />
            </button>

            <div className="space-y-2">
              <Label htmlFor="table-name">Table name</Label>
              <Input id="table-name" value={tableName} onChange={(event) => setTableName(event.target.value)} placeholder="uploaded_data" />
            </div>

            <Button
              variant={connected ? 'default' : 'secondary'}
              className="w-full rounded-2xl"
              size="lg"
              onClick={handleCsvUpload}
              disabled={!csvFile || !connected || csvLoading}
            >
              {csvLoading ? 'Importing...' : connected ? 'Import CSV' : 'Connect DB first'}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden rounded-[1.75rem]">
        <CardContent className="grid gap-6 p-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
          <div className="space-y-3">
            <div className="text-xl font-semibold">Connection workflow</div>
            <p className="text-sm leading-6 text-muted-foreground">
              Use SQLite for the demo database, or switch to MySQL/PostgreSQL for external sources. CSV imports are added into
              the active workspace so they can be queried immediately.
            </p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">Schema profiling</Badge>
              <Badge variant="outline">Prompt suggestions</Badge>
              <Badge variant="outline">CSV import</Badge>
            </div>
          </div>
          <div className="overflow-hidden rounded-[1.5rem] border bg-muted/30 p-3">
            <img src={connectIllustration} alt="Database connection workflow illustration" className="h-auto w-full rounded-[1.25rem]" />
          </div>
        </CardContent>
      </Card>

      {connected && (
        <Card className="rounded-[1.75rem]">
          <CardHeader>
            <CardTitle className="text-xl">Schema Explorer</CardTitle>
            <CardDescription>Profiled dataset metrics, recommended prompts, and a quick view of each table.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {stats && (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {[
                  ['Tables', stats.table_count],
                  ['Columns', stats.total_columns],
                  ['Relations', stats.relationship_count],
                  ['Numeric Fields', stats.numeric_column_count],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-[1.5rem] border bg-muted/30 p-4">
                    <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
                    <div className="mt-2 font-display text-3xl font-extrabold tracking-tight">{value}</div>
                  </div>
                ))}
              </div>
            )}

            {schemaProfile?.tables?.length > 0 && (
              <div className="space-y-3">
                <div className="text-sm font-semibold">Dataset intelligence</div>
                <div className="grid gap-3 xl:grid-cols-2">
                  {schemaProfile.tables.slice(0, 6).map((table) => (
                    <div key={table.name} className="rounded-[1.5rem] border p-4">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-display text-lg font-bold">{table.name}</div>
                        <Badge variant="outline">{table.row_count ?? 'Unknown'} rows</Badge>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {table.column_count} columns, {table.foreign_key_count} foreign keys
                      </p>
                      {table.numeric_columns?.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {table.numeric_columns.slice(0, 4).map((column) => (
                            <Badge key={column} variant="secondary">
                              {column}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {suggestedQuestions?.length > 0 && (
              <div className="space-y-3">
                <div className="text-sm font-semibold">Recommended questions</div>
                <div className="flex flex-wrap gap-2">
                  {suggestedQuestions.map((question) => (
                    <Badge key={question} variant="outline" className="rounded-full px-3 py-1">
                      {question}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-3">
              <div className="text-sm font-semibold">Tables in this database</div>
              <div className="overflow-hidden rounded-[1.5rem] border">
                <div className="grid grid-cols-[minmax(220px,0.8fr)_minmax(0,1.2fr)] border-b bg-muted/40 px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  <div>Table</div>
                  <div>Columns</div>
                </div>
                <div className="divide-y">
                  {tableEntries.map(([table, columns]) => (
                    <div key={table} className="grid grid-cols-[minmax(220px,0.8fr)_minmax(0,1.2fr)] gap-4 px-4 py-4">
                      <div>
                        <div className="font-display text-lg font-bold">{table}</div>
                        <div className="mt-1 text-sm text-muted-foreground">{columns.length} columns</div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {columns.map((column) => (
                          <Badge key={column} variant="secondary" className="font-mono">
                            {column.split(' ')[0]}
                          </Badge>
                        ))}
                      </div>

                      <div className="md:col-span-2">
                        <div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                          Sample content
                        </div>

                        {previewLoading && !tablePreviews[table] ? (
                          <div className="rounded-[1rem] border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                            Loading preview...
                          </div>
                        ) : tablePreviews[table]?.rows?.length > 0 ? (
                          <div className="overflow-x-auto rounded-[1rem] border">
                            <table className="min-w-full text-left text-sm">
                              <thead className="bg-muted/40">
                                <tr>
                                  {tablePreviews[table].columns.map((column) => (
                                    <th key={column} className="px-3 py-2 font-medium text-muted-foreground">
                                      {column}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {tablePreviews[table].rows.map((row, rowIndex) => (
                                  <tr key={`${table}-${rowIndex}`} className="border-t">
                                    {tablePreviews[table].columns.map((column) => (
                                      <td key={`${table}-${rowIndex}-${column}`} className="max-w-[220px] px-3 py-2 font-mono text-xs">
                                        {row[column] === null || row[column] === undefined ? 'null' : String(row[column])}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <div className="rounded-[1rem] border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                            No preview rows available.
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
