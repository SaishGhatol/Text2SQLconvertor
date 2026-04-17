import { useEffect, useState } from 'react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import api from '../../utils/api'

const s = {
  page: { padding: '32px 36px' },
  title: { fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px' },
  desc: { color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '28px' },
  searchRow: { display: 'flex', gap: '10px', marginBottom: '20px' },
  searchInput: {
    flex: 1, padding: '10px 14px',
    background: 'var(--bg-elevated)', border: '1px solid var(--border-normal)',
    borderRadius: 'var(--r-md)', color: 'var(--text-primary)',
    fontFamily: 'var(--font-body)', fontSize: '13px', outline: 'none',
  },
  list: { display: 'flex', flexDirection: 'column', gap: '12px' },
  item: {
    background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--r-lg)', overflow: 'hidden',
    transition: 'border-color 0.18s',
  },
  itemHeader: {
    padding: '14px 18px', display: 'flex', alignItems: 'flex-start',
    justifyContent: 'space-between', gap: '12px', cursor: 'pointer',
  },
  question: { fontSize: '14px', color: 'var(--text-primary)', fontWeight: 500, lineHeight: 1.4 },
  metaRow: { display: 'flex', alignItems: 'center', gap: '10px', marginTop: '6px', flexWrap: 'wrap' },
  badge: (color) => ({
    fontSize: '10px', padding: '2px 8px', borderRadius: '99px',
    background: `${color}18`, border: `1px solid ${color}40`,
    color, fontWeight: 600, fontFamily: 'var(--font-mono)',
  }),
  ts: { fontSize: '11px', color: 'var(--text-muted)' },
  chevron: (open) => ({
    fontSize: '12px', color: 'var(--text-muted)', flexShrink: 0,
    transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s',
    marginTop: '2px',
  }),
  sqlWrap: { padding: '0 18px 16px', borderTop: '1px solid var(--border-subtle)' },
  empty: {
    padding: '60px', textAlign: 'center',
    color: 'var(--text-muted)', fontSize: '14px',
  },
  shimmer: {
    height: '80px', borderRadius: 'var(--r-lg)',
    background: 'linear-gradient(90deg, var(--bg-elevated) 25%, var(--bg-overlay) 50%, var(--bg-elevated) 75%)',
    backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite',
  },
}

function fmt(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function HistoryItem({ item }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={s.item}>
      <div style={s.itemHeader} onClick={() => setOpen((v) => !v)}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={s.question}>{item.question}</div>
          <div style={s.metaRow}>
            <span style={s.badge(item.status === 'success' ? 'var(--green-400)' : 'var(--coral-400)')}>
              {item.status}
            </span>
            {item.was_corrected && <span style={s.badge('var(--amber-400)')}>auto-corrected</span>}
            {item.execution_time_ms != null && (
              <span style={s.badge('var(--teal-400)')}>{item.execution_time_ms}ms</span>
            )}
            {item.row_count != null && (
              <span style={s.badge('#a78bfa')}>{item.row_count} rows</span>
            )}
            <span style={s.ts}>{fmt(item.created_at)}</span>
          </div>
        </div>
        <span style={s.chevron(open)}>▼</span>
      </div>
      {open && item.sql && (
        <div style={s.sqlWrap}>
          <SyntaxHighlighter
            language="sql" style={vscDarkPlus}
            customStyle={{ borderRadius: '8px', fontSize: '12px', margin: '8px 0 0', background: 'var(--bg-void)', border: '1px solid var(--border-subtle)' }}
          >
            {item.sql}
          </SyntaxHighlighter>
        </div>
      )}
    </div>
  )
}

export default function HistoryPage() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    api.get('/history/?limit=50')
      .then(({ data }) => setItems(data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const filtered = items.filter(
    (it) =>
      it.question.toLowerCase().includes(search.toLowerCase()) ||
      it.sql?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div style={s.page} className="fade-up">
      <h1 style={s.title}>Query History</h1>
      <p style={s.desc}>All past queries with SQL, execution stats, and auto-correction flags.</p>

      <div style={s.searchRow}>
        <input
          style={s.searchInput}
          placeholder="Search questions or SQL…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div style={s.list}>
        {loading
          ? Array.from({ length: 5 }).map((_, i) => <div key={i} style={s.shimmer} />)
          : filtered.length === 0
          ? <div style={s.empty}>{search ? 'No results match your search.' : 'No query history yet. Ask a question to get started.'}</div>
          : filtered.map((item) => <HistoryItem key={item.id} item={item} />)
        }
      </div>
    </div>
  )
}
