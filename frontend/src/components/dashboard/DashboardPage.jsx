import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LineChart, Line } from 'recharts'
import api from '../../utils/api'
import { useQueryStore } from '../../stores/queryStore'
import {
  CHART_AXIS_TICK,
  CHART_COLORS,
  CHART_GRID_STROKE,
  CHART_TOOLTIP_ITEM_STYLE,
  CHART_TOOLTIP_LABEL_STYLE,
  CHART_TOOLTIP_STYLE,
} from '../../utils/chartTheme'

const s = {
  page: { padding: '32px 36px' },
  header: { marginBottom: '28px' },
  title: { fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px' },
  desc: { color: 'var(--text-secondary)', fontSize: '14px' },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '24px' },
  statCard: {
    background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--r-lg)', padding: '20px 22px', boxShadow: 'var(--shadow-card)',
  },
  statLabel: { fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' },
  statValue: { fontFamily: 'var(--font-display)', fontSize: '32px', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 },
  statSub: { fontSize: '12px', color: 'var(--text-secondary)', marginTop: '6px' },
  chartGrid: { display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '16px', marginBottom: '24px' },
  chartCard: {
    background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--r-lg)', padding: '22px', boxShadow: 'var(--shadow-card)',
  },
  chartTitle: { fontFamily: 'var(--font-display)', fontSize: '13px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '16px' },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' },
  box: {
    background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--r-lg)', padding: '22px', boxShadow: 'var(--shadow-card)',
  },
  row: { display: 'flex', justifyContent: 'space-between', gap: '16px', padding: '10px 0', borderBottom: '1px solid var(--border-subtle)' },
  chip: {
    padding: '4px 8px', borderRadius: '999px',
    background: 'rgba(20,184,166,0.10)', border: '1px solid rgba(20,184,166,0.18)',
    color: 'var(--teal-400)', fontSize: '11px',
  },
}

export default function DashboardPage() {
  const { schemaProfile, suggestedQuestions, savedQueries } = useQueryStore()
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/analytics/summary')
      .then(({ data }) => setSummary(data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const successRate = summary?.total_queries ? Math.round((summary.successful_queries / summary.total_queries) * 100) : 0
  const statusData = summary
    ? [
        { name: 'Success', value: summary.status_breakdown?.success ?? summary.successful_queries, fill: CHART_COLORS[0] },
        { name: 'Error', value: summary.status_breakdown?.error ?? 0, fill: CHART_COLORS[3] },
        { name: 'Auto-fix', value: summary.auto_corrected, fill: CHART_COLORS[1] },
      ]
    : []
  const activityData = (summary?.recent_activity || []).slice().reverse().map((item, index) => ({
    idx: index + 1,
    execution: item.execution_time_ms || 0,
  }))

  return (
    <div style={s.page} className="fade-up">
      <div style={s.header}>
        <h1 style={s.title}>Engineering Dashboard</h1>
        <p style={s.desc}>System analytics, dataset intelligence, and explainability signals for your Text-to-SQL project.</p>
      </div>

      <div style={s.statsGrid}>
        {[
          ['Total Queries', summary?.total_queries ?? 0, 'All-time experiments'],
          ['Success Rate', `${successRate}%`, `${summary?.successful_queries ?? 0} successful runs`],
          ['Avg Exec Time', `${summary?.avg_execution_ms ?? 0}ms`, 'Pipeline execution time'],
          ['Saved Queries', savedQueries.length, 'Reusable query library'],
        ].map(([label, value, sub]) => (
          <div key={label} style={s.statCard}>
            <div style={s.statLabel}>{label}</div>
            <div style={s.statValue}>{loading ? '--' : value}</div>
            <div style={s.statSub}>{sub}</div>
          </div>
        ))}
      </div>

      <div style={s.chartGrid}>
        <div style={s.chartCard}>
          <div style={s.chartTitle}>Query Outcome Breakdown</div>
          {!loading && statusData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={statusData} margin={{ top: 4, right: 8, left: -20, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_STROKE} />
                <XAxis dataKey="name" tick={CHART_AXIS_TICK} axisLine={false} tickLine={false} />
                <YAxis tick={CHART_AXIS_TICK} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} labelStyle={CHART_TOOLTIP_LABEL_STYLE} itemStyle={CHART_TOOLTIP_ITEM_STYLE} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {statusData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: '240px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
              No analytics yet
            </div>
          )}
        </div>

        <div style={s.chartCard}>
          <div style={s.chartTitle}>Recent Execution Trend</div>
          {!loading && activityData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={activityData} margin={{ top: 4, right: 8, left: -12, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_STROKE} />
                <XAxis dataKey="idx" tick={CHART_AXIS_TICK} axisLine={false} tickLine={false} />
                <YAxis tick={CHART_AXIS_TICK} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} labelStyle={CHART_TOOLTIP_LABEL_STYLE} itemStyle={CHART_TOOLTIP_ITEM_STYLE} />
                <Line type="monotone" dataKey="execution" stroke={CHART_COLORS[2]} strokeWidth={3} dot={{ fill: CHART_COLORS[1], stroke: 'var(--bg-elevated)', strokeWidth: 2, r: 4 }} activeDot={{ r: 6, fill: CHART_COLORS[4], stroke: 'var(--bg-elevated)', strokeWidth: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: '240px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
              Run a few queries to see timing trends
            </div>
          )}
        </div>
      </div>

      <div style={s.grid2}>
        <div style={s.box}>
          <div style={s.chartTitle}>Dataset Intelligence</div>
          <div style={s.row}>
            <span style={{ color: 'var(--text-secondary)' }}>Total tables</span>
            <strong>{schemaProfile?.overview?.table_count ?? 0}</strong>
          </div>
          <div style={s.row}>
            <span style={{ color: 'var(--text-secondary)' }}>Total columns</span>
            <strong>{schemaProfile?.overview?.total_columns ?? 0}</strong>
          </div>
          <div style={s.row}>
            <span style={{ color: 'var(--text-secondary)' }}>Numeric features</span>
            <strong>{schemaProfile?.overview?.numeric_column_count ?? 0}</strong>
          </div>
          <div style={s.row}>
            <span style={{ color: 'var(--text-secondary)' }}>Temporal features</span>
            <strong>{schemaProfile?.overview?.date_column_count ?? 0}</strong>
          </div>
          <div style={{ paddingTop: '12px', fontSize: '13px', color: 'var(--text-secondary)' }}>
            Largest table: <span style={s.chip}>{schemaProfile?.overview?.largest_table?.name || 'N/A'}</span>
          </div>
          <div style={{ paddingTop: '12px', fontSize: '13px', color: 'var(--text-secondary)' }}>
            Relationships: <span style={s.chip}>{schemaProfile?.overview?.relationship_count ?? 0}</span>
          </div>
        </div>

        <div style={s.box}>
          <div style={s.chartTitle}>Recommended Demo Questions</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {(suggestedQuestions || []).slice(0, 6).map((question) => (
              <div key={question} style={{ ...s.row, alignItems: 'flex-start' }}>
                <span style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>{question}</span>
              </div>
            ))}
            {(!suggestedQuestions || suggestedQuestions.length === 0) && (
              <div style={{ color: 'var(--text-muted)' }}>Connect a database to generate schema-aware question suggestions.</div>
            )}
          </div>
        </div>
      </div>

      <div style={s.box}>
        <div style={s.chartTitle}>Saved Query Library</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
          <div>
            <div style={{ ...s.statValue, fontSize: '28px' }}>{savedQueries.length}</div>
            <div style={s.statSub}>Saved prompts and SQL templates ready to rerun from the chat workspace.</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {savedQueries.slice(0, 3).map((item) => (
              <div key={item.id} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--r-md)', padding: '14px 16px' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>{item.name}</div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '12px', lineHeight: 1.6 }}>{item.question || 'Saved SQL query'}</div>
              </div>
            ))}
            {savedQueries.length === 0 && <div style={{ color: 'var(--text-muted)' }}>Save a generated query from the chat page to build a reusable analytics library.</div>}
          </div>
        </div>
      </div>

      <div style={s.box}>
        <div style={s.chartTitle}>Project Positioning</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
          {[
            ['Problem', 'Natural language analytics is hard for non-technical users, especially on relational databases with joins and aggregates.'],
            ['Method', 'Schema-aware prompting, self-healing SQL retries, JWT-secured API orchestration, and profile-driven dashboarding.'],
            ['Outcome', 'An offline analytics assistant that converts English to SQL, executes safely, explains results, and profiles datasets for decision support.'],
          ].map(([title, body]) => (
            <div key={title} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--r-md)', padding: '16px' }}>
              <div style={{ fontFamily: 'var(--font-display)', color: 'var(--amber-400)', marginBottom: '8px', fontSize: '13px', fontWeight: 700 }}>{title}</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: 1.7 }}>{body}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
