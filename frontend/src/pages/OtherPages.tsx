import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { examsApi, resultsApi, subjectsApi, auditApi } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import { AppShell } from '@/components/layout/AppShell'
import {
  Card, CardHeader, Button, Badge, StatusBadge, PageLoader,
  EmptyState, SearchBar, ScoreRing, Tabs, Avatar, StatCard, ProgressBar,
} from '@/components/ui'

// ══════════════════════════════════════════════════════════════════════════════
// EXAMS LIST
// ══════════════════════════════════════════════════════════════════════════════
export function ExamsListPage() {
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['exams', { page, search, statusFilter }],
    queryFn: () => examsApi.list({
      page,
      size: 12,
      search: search || undefined,
      status: statusFilter || undefined,
    }),
  })

  const publishMutation = useMutation({
    mutationFn: examsApi.publish,
    onSuccess: () => { toast.success('Exam published!'); qc.invalidateQueries({ queryKey: ['exams'] }) },
  })

  const cloneMutation = useMutation({
    mutationFn: examsApi.clone,
    onSuccess: () => { toast.success('Exam cloned!'); qc.invalidateQueries({ queryKey: ['exams'] }) },
  })

  const deleteMutation = useMutation({
    mutationFn: examsApi.delete,
    onSuccess: () => { toast.success('Exam deleted'); qc.invalidateQueries({ queryKey: ['exams'] }) },
  })

  const canManage = user?.role === 'instructor' || user?.role === 'admin'
  const exams = data?.items || []

  return (
    <AppShell title="Exams">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-bold text-gray-900">
            {user?.role === 'student' ? 'Available Exams' : 'My Exams'}
          </h2>
          <p className="text-sm text-gray-500">{data?.total || 0} exams found</p>
        </div>
        {canManage && (
          <Link to="/exams/create">
            <Button variant="primary">+ Create Exam</Button>
          </Link>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <SearchBar value={search} onChange={setSearch} placeholder="Search exams…" />
        <div className="flex gap-2">
          {['', 'draft', 'published', 'live', 'completed'].map(s => (
            <button
              key={s}
              onClick={() => { setStatusFilter(s); setPage(1) }}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                statusFilter === s
                  ? 'bg-brand-600 text-white border-brand-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-brand-300'
              }`}
            >
              {s === '' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? <PageLoader /> : exams.length === 0 ? (
        <EmptyState icon="📝" title="No exams found" description="Try adjusting your filters." />
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {exams.map(exam => (
              <div key={exam.id} className={`card p-4 flex flex-col border-l-4 ${
                exam.status === 'live' ? 'border-l-green-500' :
                exam.status === 'published' ? 'border-l-brand-500' :
                exam.status === 'completed' ? 'border-l-gray-300' : 'border-l-amber-400'
              }`}>
                <div className="flex items-start justify-between mb-2">
                  <StatusBadge status={exam.status} />
                  <span className="text-xs text-gray-400">{exam.duration_minutes} min</span>
                </div>

                <h3 className="font-semibold text-sm text-gray-900 mb-1 line-clamp-2">{exam.title}</h3>
                {exam.subject && <Badge variant="blue" className="mb-3 self-start">{exam.subject.name}</Badge>}

                <div className="text-xs text-gray-500 space-y-1 mb-3">
                  <div className="flex justify-between">
                    <span>Marks:</span>
                    <span className="font-medium">{exam.total_marks} (pass: {exam.passing_marks})</span>
                  </div>
                  {exam.scheduled_start && (
                    <div className="flex justify-between">
                      <span>Scheduled:</span>
                      <span className="font-medium">{format(new Date(exam.scheduled_start), 'MMM d, h:mm a')}</span>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 mt-auto pt-3 border-t border-gray-100">
                  {exam.status === 'live' && user?.role === 'student' && (
                    <Link to={`/exam/${exam.id}/start`} className="flex-1">
                      <Button variant="success" size="sm" className="w-full">🚀 Start Now</Button>
                    </Link>
                  )}
                  {exam.status === 'completed' && user?.role === 'student' && (
                    <Link to="/results" className="flex-1">
                      <Button variant="secondary" size="sm" className="w-full">View Result</Button>
                    </Link>
                  )}
                  {canManage && (
                    <>
                      <Link to={`/exams/${exam.id}/edit`}>
                        <Button variant="ghost" size="sm">Edit</Button>
                      </Link>
                      {exam.status === 'draft' && (
                        <Button variant="primary" size="sm" loading={publishMutation.isPending}
                          onClick={() => publishMutation.mutate(exam.id)}>
                          Publish
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => cloneMutation.mutate(exam.id)}>Clone</Button>
                      {exam.status === 'draft' && (
                        <Button variant="ghost" size="sm" className="text-red-500"
                          onClick={() => { if (confirm('Delete this exam?')) deleteMutation.mutate(exam.id) }}>
                          Delete
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {data && data.pages > 1 && (
            <div className="flex justify-center gap-1 mt-6">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">
                ←
              </button>
              {Array.from({ length: data.pages }, (_, i) => i + 1).map(p => (
                <button key={p} onClick={() => setPage(p)}
                  className={`w-8 h-8 text-xs rounded-lg transition-colors ${
                    page === p ? 'bg-brand-600 text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}>{p}</button>
              ))}
              <button onClick={() => setPage(p => Math.min(data.pages, p + 1))} disabled={page === data.pages}
                className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">
                →
              </button>
            </div>
          )}
        </>
      )}
    </AppShell>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// EXAM RESULTS (Instructor view)
// ══════════════════════════════════════════════════════════════════════════════
export function ExamResultsPage() {
  const { examId } = useParams<{ examId: string }>()
  const qc = useQueryClient()

  const { data: exam } = useQuery({
    queryKey: ['exam', examId],
    queryFn: () => examsApi.get(examId!),
    enabled: !!examId,
  })

  const { data: resultsData, isLoading } = useQuery({
    queryKey: ['results', 'exam', examId],
    queryFn: () => resultsApi.examResults(examId!, { size: 50 }),
    enabled: !!examId,
  })

  const publishAllMutation = useMutation({
    mutationFn: () => resultsApi.publishAll(examId!),
    onSuccess: () => { toast.success('All results published!'); qc.invalidateQueries({ queryKey: ['results', 'exam', examId] }) },
  })

  const results = resultsData?.items || []
  const passed = results.filter(r => r.is_passed).length
  const avgPct = results.length ? Math.round(results.reduce((a, r) => a + r.percentage, 0) / results.length) : 0

  return (
    <AppShell title="Exam Results">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-bold text-gray-900">{exam?.title || 'Exam Results'}</h2>
          <p className="text-sm text-gray-500">{resultsData?.total || 0} results</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm">📥 Export CSV</Button>
          <Button variant="primary" size="sm" loading={publishAllMutation.isPending}
            onClick={() => publishAllMutation.mutate()}>
            📢 Publish All
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-5">
        <StatCard label="Attempts" value={results.length} icon="📝" color="blue" />
        <StatCard label="Passed" value={passed} icon="✅" color="green" />
        <StatCard label="Failed" value={results.length - passed} icon="❌" color="red" />
        <StatCard label="Pass Rate" value={`${results.length ? Math.round(passed / results.length * 100) : 0}%`} icon="📊" color="amber" />
        <StatCard label="Avg Score" value={`${avgPct}%`} icon="📈" color="purple" />
      </div>

      {isLoading ? <PageLoader /> : (
        <Card className="p-0 overflow-hidden">
          <table className="table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Student</th>
                <th>Score</th>
                <th>Percentage</th>
                <th>Status</th>
                <th>Correct</th>
                <th>Wrong</th>
                <th>Published</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r, i) => (
                <tr key={r.id}>
                  <td>
                    <span className={`text-sm font-bold ${i === 0 ? 'text-amber-600' : i === 1 ? 'text-gray-500' : i === 2 ? 'text-orange-500' : 'text-gray-700'}`}>
                      #{r.rank || i + 1}
                    </span>
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <Avatar name={`Student ${i + 1}`} size="sm" />
                      <span className="text-sm text-gray-700 font-medium">{r.student_id.slice(0, 8)}…</span>
                    </div>
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <ScoreRing pct={Math.round(r.percentage)} size={36} />
                      <span className="font-semibold text-sm">{r.obtained_marks}/{r.total_marks}</span>
                    </div>
                  </td>
                  <td>{Math.round(r.percentage)}%</td>
                  <td>
                    <span className={`badge ${r.is_passed ? 'badge-green' : 'badge-red'}`}>
                      {r.is_passed ? '✓ Pass' : '✗ Fail'}
                    </span>
                  </td>
                  <td className="text-green-600 font-medium">{r.correct_answers}</td>
                  <td className="text-red-500 font-medium">{r.wrong_answers}</td>
                  <td>
                    <span className={`badge ${r.is_published ? 'badge-green' : 'badge-gray'}`}>
                      {r.is_published ? 'Published' : 'Draft'}
                    </span>
                  </td>
                </tr>
              ))}
              {results.length === 0 && (
                <tr><td colSpan={8} className="text-center py-10 text-sm text-gray-400">No results yet</td></tr>
              )}
            </tbody>
          </table>
        </Card>
      )}
    </AppShell>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// SUBJECTS PAGE
// ══════════════════════════════════════════════════════════════════════════════
export function SubjectsPage() {
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ name: '', code: '', description: '', department: '', credits: '' })

  const { data: subjects, isLoading } = useQuery({
    queryKey: ['subjects'],
    queryFn: subjectsApi.list,
  })

  const createMutation = useMutation({
    mutationFn: () => subjectsApi.create({ ...form, credits: form.credits ? +form.credits : undefined } as any),
    onSuccess: () => { toast.success('Subject created!'); qc.invalidateQueries({ queryKey: ['subjects'] }); setShowAdd(false); setForm({ name: '', code: '', description: '', department: '', credits: '' }) },
  })

  const deleteMutation = useMutation({
    mutationFn: subjectsApi.delete,
    onSuccess: () => { toast.success('Subject deactivated'); qc.invalidateQueries({ queryKey: ['subjects'] }) },
  })

  const canEdit = user?.role === 'admin' || user?.role === 'instructor'

  return (
    <AppShell title="Subjects">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Subjects</h2>
          <p className="text-sm text-gray-500">{subjects?.length || 0} subjects</p>
        </div>
        {canEdit && <Button variant="primary" size="sm" onClick={() => setShowAdd(true)}>+ Add Subject</Button>}
      </div>

      {isLoading ? <PageLoader /> : (
        <div className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {(subjects || []).map(s => (
            <Card key={s.id} className="p-4 flex flex-col gap-2">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-semibold text-sm text-gray-900">{s.name}</div>
                  <Badge variant="blue" className="mt-1">{s.code}</Badge>
                </div>
                {s.credits && <Badge variant="gray">{s.credits} cr</Badge>}
              </div>
              {s.department && <div className="text-xs text-gray-500">{s.department}</div>}
              {s.description && <p className="text-xs text-gray-500 line-clamp-2">{s.description}</p>}
              {canEdit && user?.role === 'admin' && (
                <button onClick={() => deleteMutation.mutate(s.id)}
                  className="text-xs text-red-400 hover:text-red-600 mt-1 self-start">
                  Deactivate
                </button>
              )}
            </Card>
          ))}
          {(!subjects || subjects.length === 0) && (
            <div className="col-span-full">
              <EmptyState icon="📚" title="No subjects yet" description="Add subjects to organize your question bank and exams." />
            </div>
          )}
        </div>
      )}

      {/* Add modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={e => e.target === e.currentTarget && setShowAdd(false)}>
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Add New Subject</h2>
            <div className="space-y-3">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Subject Name *</label><input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Computer Networks" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Subject Code *</label><input className="input" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} placeholder="e.g. CN401" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Department</label><input className="input" value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))} placeholder="e.g. CSE" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Credits</label><input type="number" className="input" value={form.credits} onChange={e => setForm(f => ({ ...f, credits: e.target.value }))} /></div>
              </div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Description</label><textarea className="input" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} /></div>
            </div>
            <div className="flex gap-2 justify-end mt-5">
              <Button variant="secondary" onClick={() => setShowAdd(false)}>Cancel</Button>
              <Button variant="primary" loading={createMutation.isPending} onClick={() => createMutation.mutate()}>Create Subject</Button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// AUDIT LOGS (Admin)
// ══════════════════════════════════════════════════════════════════════════════
export function AuditLogsPage() {
  const [page, setPage] = useState(1)
  const [actionFilter, setActionFilter] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', { page, actionFilter }],
    queryFn: () => auditApi.list({ page, size: 25, action: actionFilter || undefined }),
  })

  const actionColor: Record<string, string> = {
    login: 'badge-blue', logout: 'badge-gray',
    exam_started: 'badge-green', exam_submitted: 'badge-green',
    tab_switch: 'badge-red', copy_attempt: 'badge-red', fullscreen_exit: 'badge-amber',
    exam_created: 'badge-blue', exam_published: 'badge-blue',
    user_created: 'badge-purple', user_updated: 'badge-gray',
    question_added: 'badge-purple', result_published: 'badge-green',
  }

  return (
    <AppShell title="Audit Logs">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Audit Logs</h2>
          <p className="text-sm text-gray-500">Complete system activity history</p>
        </div>
        <Button variant="secondary" size="sm">📥 Export CSV</Button>
      </div>

      {/* Filters */}
      <Card className="mb-4 p-3">
        <div className="flex flex-wrap gap-2">
          {['', 'login', 'exam_started', 'exam_submitted', 'tab_switch', 'user_created', 'exam_created'].map(a => (
            <button key={a} onClick={() => { setActionFilter(a); setPage(1) }}
              className={`px-2.5 py-1 text-xs rounded-lg border transition-colors ${
                actionFilter === a ? 'bg-brand-600 text-white border-brand-600' : 'bg-white border-gray-200 text-gray-600 hover:border-brand-300'
              }`}>
              {a === '' ? 'All Actions' : a.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      </Card>

      {isLoading ? <PageLoader /> : (
        <>
          <Card className="p-0 overflow-hidden">
            <table className="table">
              <thead>
                <tr><th>Time</th><th>User</th><th>Action</th><th>Resource</th><th>IP</th><th>Type</th></tr>
              </thead>
              <tbody>
                {(data?.items || []).map(log => (
                  <tr key={log.id}>
                    <td className="text-xs text-gray-400 font-mono whitespace-nowrap">
                      {format(new Date(log.occurred_at), 'MMM d, HH:mm:ss')}
                    </td>
                    <td className="text-xs text-gray-700 font-medium max-w-[120px] truncate">
                      {log.user_id ? log.user_id.slice(0, 8) + '…' : 'System'}
                    </td>
                    <td>
                      <span className={`badge ${actionColor[log.action] || 'badge-gray'} text-[10px]`}>
                        {log.action.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="text-xs text-gray-500">
                      {log.resource_type && <><span className="font-medium">{log.resource_type}</span>{log.resource_id && <span className="ml-1 text-gray-400">{log.resource_id.slice(0, 8)}…</span>}</>}
                    </td>
                    <td className="text-xs font-mono text-gray-400">{log.ip_address || '—'}</td>
                    <td className="text-xs text-gray-500">{log.description?.slice(0, 40) || '—'}</td>
                  </tr>
                ))}
                {(!data?.items || data.items.length === 0) && (
                  <tr><td colSpan={6} className="text-center py-10 text-sm text-gray-400">No audit logs found</td></tr>
                )}
              </tbody>
            </table>
          </Card>

          {data && data.pages > 1 && (
            <div className="flex justify-center gap-1 mt-4">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg disabled:opacity-40">←</button>
              <span className="px-3 py-1.5 text-xs text-gray-500">Page {page} of {data.pages}</span>
              <button onClick={() => setPage(p => Math.min(data.pages, p + 1))} disabled={page === data.pages}
                className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg disabled:opacity-40">→</button>
            </div>
          )}
        </>
      )}
    </AppShell>
  )
}
