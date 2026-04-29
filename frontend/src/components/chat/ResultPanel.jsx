import { useMemo, useState } from 'react'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import {
  CHART_AXIS_TICK,
  CHART_COLORS,
  CHART_GRID_STROKE,
  CHART_TOOLTIP_ITEM_STYLE,
  CHART_TOOLTIP_LABEL_STYLE,
  CHART_TOOLTIP_STYLE,
} from '../../utils/chartTheme'

function numericColumns(columns, rows) {
  if (!rows?.length) return []
  return columns.filter((c) => rows.some((row) => typeof row[c] === 'number'))
}

function categoryColumns(columns, rows) {
  if (!rows?.length) return []
  return columns.filter((c) => rows.some((row) => typeof row[c] === 'string'))
}

function defaultChart(columns, rows) {
  if (!rows?.length || columns.length < 2) return null
  const nums = numericColumns(columns, rows)
  if (!nums.length) return null
  const cats = categoryColumns(columns, rows)
  const xKey = cats[0] || columns.find((c) => c !== nums[0]) || columns[0]
  const type = rows.length <= 15 ? 'bar' : 'line'
  return { type, xKey, yKey: nums[0] }
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function escapeCsv(value) {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (/[",\n]/.test(str)) return `"${str.replaceAll('"', '""')}"`
  return str
}

function exportCsv(columns, rows) {
  const header = columns.map(escapeCsv).join(',')
  const body = rows.map((row) => columns.map((col) => escapeCsv(row[col])).join(',')).join('\n')
  downloadFile('smartquery-results.csv', `${header}\n${body}`, 'text/csv;charset=utf-8')
}

function exportJson(rows) {
  downloadFile('smartquery-results.json', JSON.stringify(rows, null, 2), 'application/json;charset=utf-8')
}

const s = {
  wrap: { marginTop: '16px' },
  tabs: { display: 'flex', gap: 0, borderBottom: '1px solid hsl(var(--border))', marginBottom: '14px', flexWrap: 'wrap' },
  tab: (active) => ({
    padding: '7px 0', marginRight: '20px', fontSize: '12px', fontWeight: 700,
    letterSpacing: '0.04em', textTransform: 'uppercase', color: active ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))',
    borderBottom: active ? '2px solid hsl(var(--primary))' : '2px solid transparent',
    background: 'none', borderTop: 'none', borderLeft: 'none', borderRight: 'none', cursor: 'pointer', marginBottom: '-1px',
  }),
  controls: { display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', marginBottom: '12px' },
  select: { border: '1px solid hsl(var(--border))', background: 'hsl(var(--background))', color: 'hsl(var(--foreground))', borderRadius: '12px', padding: '8px 10px', fontSize: '12px' },
  button: { border: '1px solid hsl(var(--border))', background: 'hsl(var(--background))', color: 'hsl(var(--foreground))', borderRadius: '999px', padding: '8px 12px', fontSize: '12px', cursor: 'pointer' },
  tableWrap: { overflowX: 'auto', borderRadius: '16px', border: '1px solid hsl(var(--border))', maxHeight: '320px', overflowY: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '13px' },
  th: { padding: '9px 12px', textAlign: 'left', background: 'hsl(var(--muted))', borderBottom: '1px solid hsl(var(--border))', color: 'hsl(var(--muted-foreground))', fontSize: '11px', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', whiteSpace: 'nowrap', position: 'sticky', top: 0 },
  td: (i) => ({ padding: '8px 12px', borderBottom: '1px solid hsl(var(--border))', color: 'hsl(var(--foreground))', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '12px', background: i % 2 === 0 ? 'transparent' : 'hsl(var(--muted) / 0.25)' }),
  chartWrap: { padding: '8px 0' },
  explanationBox: { background: 'hsl(var(--muted) / 0.35)', border: '1px solid hsl(var(--border))', borderRadius: '16px', padding: '14px 16px' },
  explanationTitle: { fontSize: '11px', fontWeight: 700, letterSpacing: '0.05em', color: 'hsl(var(--foreground))', textTransform: 'uppercase', marginBottom: '10px' },
  explanationText: { fontSize: '13px', color: 'hsl(var(--muted-foreground))', lineHeight: 1.7, whiteSpace: 'pre-wrap' },
  insightsBox: { marginTop: '12px', background: 'hsl(var(--secondary) / 0.45)', border: '1px solid hsl(var(--border))', borderRadius: '16px', padding: '14px 16px' },
}

export default function ResultPanel({ columns = [], rows = [], explanation, insights, sqlAnalysis }) {
  const [tab, setTab] = useState('table')
  const nums = useMemo(() => numericColumns(columns, rows), [columns, rows])
  const cats = useMemo(() => categoryColumns(columns, rows), [columns, rows])
  const initial = useMemo(() => defaultChart(columns, rows), [columns, rows])
  const [chartType, setChartType] = useState(initial?.type || 'bar')
  const [xKey, setXKey] = useState(initial?.xKey || columns[0] || '')
  const [yKey, setYKey] = useState(initial?.yKey || nums[0] || '')
  const [secondaryYKey, setSecondaryYKey] = useState(nums[1] || nums[0] || '')
  const canChart = rows.length > 0 && columns.length >= 2 && nums.length > 0
  const tabs = ['table', canChart ? 'chart' : null, 'explain', sqlAnalysis ? 'analysis' : null].filter(Boolean)

  const chartRows = rows.slice(0, 100)
  const safeXKey = chartType === 'scatter' && !nums.includes(xKey) ? nums[0] : xKey
  const safeYKey = yKey || nums[0]
  const safeSecondaryYKey = secondaryYKey || nums.find((n) => n !== safeYKey) || safeYKey

  return (
    <div style={s.wrap}>
      <div style={s.tabs}>
        {tabs.map((t) => (
          <button key={t} style={s.tab(tab === t)} onClick={() => setTab(t)}>
            {t === 'table' ? `Results (${rows.length})` : t === 'chart' ? 'Chart Builder' : t === 'explain' ? 'Explain' : 'Analysis'}
          </button>
        ))}
      </div>

      {tab === 'table' && (
        <>
          <div style={s.controls}>
            <button style={s.button} onClick={() => exportCsv(columns, rows)}>Export CSV</button>
            <button style={s.button} onClick={() => exportJson(rows)}>Export JSON</button>
          </div>
          <div style={s.tableWrap}>
            <table style={s.table}>
              <thead><tr>{columns.map((c) => <th key={c} style={s.th}>{c}</th>)}</tr></thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i}>{columns.map((c) => <td key={c} style={s.td(i)}>{row[c] === null ? <span style={{ color: 'hsl(var(--muted-foreground))', fontStyle: 'italic' }}>null</span> : String(row[c])}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'chart' && canChart && (
        <div style={s.chartWrap}>
          <div style={s.controls}>
            <select style={s.select} value={chartType} onChange={(e) => setChartType(e.target.value)}>
              <option value="bar">Bar</option>
              <option value="line">Line</option>
              <option value="pie">Pie</option>
              <option value="scatter">Scatter</option>
            </select>
            <select style={s.select} value={safeXKey} onChange={(e) => setXKey(e.target.value)}>
              {(chartType === 'scatter' ? nums : columns).map((c) => <option key={c} value={c}>X: {c}</option>)}
            </select>
            <select style={s.select} value={safeYKey} onChange={(e) => setYKey(e.target.value)}>
              {nums.map((c) => <option key={c} value={c}>Y: {c}</option>)}
            </select>
            {chartType === 'scatter' && (
              <select style={s.select} value={safeSecondaryYKey} onChange={(e) => setSecondaryYKey(e.target.value)}>
                {nums.map((c) => <option key={c} value={c}>Y2: {c}</option>)}
              </select>
            )}
            <span style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))' }}>Showing first 100 rows</span>
          </div>

          <ResponsiveContainer width="100%" height={300}>
            {chartType === 'bar' ? (
              <BarChart data={chartRows} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_STROKE} />
                <XAxis dataKey={safeXKey} tick={CHART_AXIS_TICK} axisLine={false} tickLine={false} />
                <YAxis tick={CHART_AXIS_TICK} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} labelStyle={CHART_TOOLTIP_LABEL_STYLE} itemStyle={CHART_TOOLTIP_ITEM_STYLE} />
                <Bar dataKey={safeYKey} radius={[6, 6, 0, 0]}>{chartRows.map((_, idx) => <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />)}</Bar>
              </BarChart>
            ) : chartType === 'line' ? (
              <LineChart data={chartRows} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_STROKE} />
                <XAxis dataKey={safeXKey} tick={CHART_AXIS_TICK} axisLine={false} tickLine={false} />
                <YAxis tick={CHART_AXIS_TICK} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} labelStyle={CHART_TOOLTIP_LABEL_STYLE} itemStyle={CHART_TOOLTIP_ITEM_STYLE} />
                <Line type="monotone" dataKey={safeYKey} stroke={CHART_COLORS[0]} strokeWidth={3} dot={{ r: 3 }} />
              </LineChart>
            ) : chartType === 'scatter' ? (
              <ScatterChart margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_STROKE} />
                <XAxis dataKey={safeXKey} name={safeXKey} tick={CHART_AXIS_TICK} axisLine={false} tickLine={false} />
                <YAxis dataKey={safeYKey} name={safeYKey} tick={CHART_AXIS_TICK} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={CHART_TOOLTIP_STYLE} labelStyle={CHART_TOOLTIP_LABEL_STYLE} itemStyle={CHART_TOOLTIP_ITEM_STYLE} />
                <Scatter name={`${safeXKey} vs ${safeYKey}`} data={chartRows} fill={CHART_COLORS[0]} />
              </ScatterChart>
            ) : (
              <PieChart>
                <Pie data={chartRows} dataKey={safeYKey} nameKey={safeXKey} cx="50%" cy="50%" outerRadius={105} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                  {chartRows.map((_, idx) => <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} labelStyle={CHART_TOOLTIP_LABEL_STYLE} itemStyle={CHART_TOOLTIP_ITEM_STYLE} />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
              </PieChart>
            )}
          </ResponsiveContainer>
        </div>
      )}

      {tab === 'explain' && (
        <div>
          {explanation && <div style={s.explanationBox}><div style={s.explanationTitle}>SQL Explanation</div><div style={s.explanationText}>{explanation}</div></div>}
          {insights && <div style={s.insightsBox}><div style={s.explanationTitle}>Follow-up Suggestions</div><div style={s.explanationText}>{insights}</div></div>}
        </div>
      )}

      {tab === 'analysis' && sqlAnalysis && (
        <div>
          <div style={s.explanationBox}><div style={s.explanationTitle}>Query Complexity</div><div style={s.explanationText}>{sqlAnalysis.complexity_label} ({sqlAnalysis.complexity_score}/10){'\n'}Tables: {sqlAnalysis.tables?.join(', ') || 'Not detected'}</div></div>
          <div style={s.insightsBox}><div style={s.explanationTitle}>Execution Structure</div><div style={s.explanationText}>{Object.entries(sqlAnalysis.clauses || {}).filter(([, enabled]) => enabled).map(([name]) => `- ${name.replaceAll('_', ' ')}`).join('\n') || 'No advanced clauses detected'}{'\n\n'}Result shape: {sqlAnalysis.result_shape?.row_count ?? rows.length} rows x {sqlAnalysis.result_shape?.column_count ?? columns.length} columns</div></div>
        </div>
      )}
    </div>
  )
}
