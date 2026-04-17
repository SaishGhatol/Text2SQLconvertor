import { useState } from 'react'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
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

function detectChartType(columns, rows) {
  if (!rows || rows.length === 0 || columns.length < 2) return null
  const numericCols = columns.filter((c) => typeof rows[0][c] === 'number')
  if (numericCols.length === 0) return null
  const catCol = columns.find((c) => typeof rows[0][c] === 'string')
  if (!catCol) return null
  if (rows.length <= 2 && numericCols.length >= 2) return { type: 'pie', xKey: catCol, yKey: numericCols[0] }
  if (rows.length <= 15) return { type: 'bar', xKey: catCol, yKey: numericCols[0] }
  return { type: 'line', xKey: catCol, yKey: numericCols[0] }
}

const s = {
  wrap: { marginTop: '16px' },
  tabs: {
    display: 'flex', gap: '0', borderBottom: '1px solid var(--border-subtle)',
    marginBottom: '14px',
  },
  tab: (active) => ({
    padding: '7px 0', marginRight: '20px',
    fontFamily: 'var(--font-display)', fontSize: '12px', fontWeight: 600,
    letterSpacing: '0.04em', textTransform: 'uppercase',
    color: active ? 'var(--amber-400)' : 'var(--text-muted)',
    borderBottom: active ? '2px solid var(--amber-400)' : '2px solid transparent',
    background: 'none', borderTop: 'none', borderLeft: 'none', borderRight: 'none', cursor: 'pointer',
    marginBottom: '-1px', transition: 'color 0.18s',
  }),
  tableWrap: {
    overflowX: 'auto', borderRadius: 'var(--r-md)',
    border: '1px solid var(--border-subtle)', maxHeight: '320px', overflowY: 'auto',
  },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '13px' },
  th: {
    padding: '9px 12px', textAlign: 'left',
    background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-subtle)',
    color: 'var(--text-secondary)', fontSize: '11px', fontWeight: 600,
    letterSpacing: '0.05em', textTransform: 'uppercase',
    fontFamily: 'var(--font-display)', whiteSpace: 'nowrap',
    position: 'sticky', top: 0,
  },
  td: (i) => ({
    padding: '8px 12px', borderBottom: '1px solid var(--border-subtle)',
    color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: '12px',
    background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)',
  }),
  chartWrap: { padding: '8px 0' },
  explanationBox: {
    background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--r-md)', padding: '14px 16px',
  },
  explanationTitle: {
    fontSize: '11px', fontWeight: 600, letterSpacing: '0.05em',
    color: 'var(--teal-400)', textTransform: 'uppercase', marginBottom: '10px',
  },
  explanationText: { fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.7, whiteSpace: 'pre-wrap' },
  insightsBox: {
    marginTop: '12px', background: 'rgba(245,158,11,0.06)',
    border: '1px solid rgba(245,158,11,0.15)',
    borderRadius: 'var(--r-md)', padding: '14px 16px',
  },
  insightsTitle: {
    fontSize: '11px', fontWeight: 600, letterSpacing: '0.05em',
    color: 'var(--amber-400)', textTransform: 'uppercase', marginBottom: '10px',
  },
  insightsText: { fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.7, whiteSpace: 'pre-wrap' },
}

export default function ResultPanel({ columns, rows, explanation, insights, sqlAnalysis }) {
  const [tab, setTab] = useState('table')
  const chart = detectChartType(columns, rows)
  const tabs = ['table', chart ? 'chart' : null, 'explain', sqlAnalysis ? 'analysis' : null].filter(Boolean)

  return (
    <div style={s.wrap}>
      <div style={s.tabs}>
        {tabs.map((t) => (
          <button key={t} style={s.tab(tab === t)} onClick={() => setTab(t)}>
            {t === 'table' ? `Results (${rows.length})` : t === 'chart' ? 'Chart' : t === 'explain' ? 'Explain' : 'Analysis'}
          </button>
        ))}
      </div>

      {tab === 'table' && (
        <div style={s.tableWrap}>
          <table style={s.table}>
            <thead>
              <tr>{columns.map((c) => <th key={c} style={s.th}>{c}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i}>
                  {columns.map((c) => (
                    <td key={c} style={s.td(i)}>
                      {row[c] === null ? <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>null</span> : String(row[c])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'chart' && chart && (
        <div style={s.chartWrap}>
          <ResponsiveContainer width="100%" height={260}>
            {chart.type === 'bar' ? (
              <BarChart data={rows} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_STROKE} />
                <XAxis dataKey={chart.xKey} tick={CHART_AXIS_TICK} axisLine={false} tickLine={false} />
                <YAxis tick={CHART_AXIS_TICK} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={CHART_TOOLTIP_STYLE}
                  labelStyle={CHART_TOOLTIP_LABEL_STYLE}
                  itemStyle={CHART_TOOLTIP_ITEM_STYLE}
                  cursor={{ fill: 'rgba(15,118,110,0.08)' }}
                />
                <Bar dataKey={chart.yKey} radius={[6, 6, 0, 0]}>
                  {rows.map((_, idx) => <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />)}
                </Bar>
              </BarChart>
            ) : chart.type === 'line' ? (
              <LineChart data={rows} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_STROKE} />
                <XAxis dataKey={chart.xKey} tick={CHART_AXIS_TICK} axisLine={false} tickLine={false} />
                <YAxis tick={CHART_AXIS_TICK} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} labelStyle={CHART_TOOLTIP_LABEL_STYLE} itemStyle={CHART_TOOLTIP_ITEM_STYLE} />
                <Line type="monotone" dataKey={chart.yKey} stroke={CHART_COLORS[0]} strokeWidth={3} dot={{ fill: CHART_COLORS[1], stroke: 'var(--bg-elevated)', strokeWidth: 2, r: 4 }} activeDot={{ r: 6, fill: CHART_COLORS[2], stroke: 'var(--bg-elevated)', strokeWidth: 2 }} />
              </LineChart>
            ) : (
              <PieChart>
                <Pie data={rows} dataKey={chart.yKey} nameKey={chart.xKey} cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                  {rows.map((_, idx) => <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} labelStyle={CHART_TOOLTIP_LABEL_STYLE} itemStyle={CHART_TOOLTIP_ITEM_STYLE} />
                <Legend wrapperStyle={{ fontSize: '12px', color: '#8899bb' }} />
              </PieChart>
            )}
          </ResponsiveContainer>
        </div>
      )}

      {tab === 'explain' && (
        <div>
          {explanation && (
            <div style={s.explanationBox}>
              <div style={s.explanationTitle}>SQL Explanation</div>
              <div style={s.explanationText}>{explanation}</div>
            </div>
          )}
          {insights && (
            <div style={s.insightsBox}>
              <div style={s.insightsTitle}>Follow-up Suggestions</div>
              <div style={s.insightsText}>{insights}</div>
            </div>
          )}
        </div>
      )}

      {tab === 'analysis' && sqlAnalysis && (
        <div>
          <div style={s.explanationBox}>
            <div style={s.explanationTitle}>Query Complexity</div>
            <div style={s.explanationText}>
              {sqlAnalysis.complexity_label} ({sqlAnalysis.complexity_score}/10)
              {'\n'}Tables: {sqlAnalysis.tables?.join(', ') || 'Not detected'}
            </div>
          </div>
          <div style={s.insightsBox}>
            <div style={s.insightsTitle}>Execution Structure</div>
            <div style={s.insightsText}>
              {Object.entries(sqlAnalysis.clauses || {})
                .filter(([, enabled]) => enabled)
                .map(([name]) => `- ${name.replaceAll('_', ' ')}`)
                .join('\n') || 'No advanced clauses detected'}
              {'\n\n'}Result shape: {sqlAnalysis.result_shape?.row_count ?? rows.length} rows x {sqlAnalysis.result_shape?.column_count ?? columns.length} columns
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
