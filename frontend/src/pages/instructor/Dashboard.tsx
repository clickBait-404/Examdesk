import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { examsApi, analyticsApi } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import { AppShell } from '@/components/layout/AppShell'
import { StatCard, Card, CardHeader, StatusBadge, PageLoader, Button, Badge } from '@/components/ui'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts'

export default function InstructorDashboard() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const firstName = user?.full_name?.split(' ')[0] || 'Professor'

  const { data: analytics, isLoading: aLoading } = useQuery({
    queryKey: ['analytics', 'instructor'],
    queryFn: analyticsApi.instructor,
  })

  const { data: examsData, isLoading: eLoading } = useQuery({
    queryKey: ['exams', 'instructor', 'all'],
    queryFn: () => examsApi.list({ size: 20 }),
  })

  const publishMutation = useMutation({
    mutationFn: (id: string) => examsApi.publish(id),
    onSuccess: () => {
      toast.success('Exam published successfully!')
      qc.invalidateQueries({ queryKey: ['exams'] })
    },
  })

  const cloneMutation = useMutation({
    mutationFn: (id: string) => examsApi.clone(id),
    onSuccess: (exam) => {
      toast.success('Exam cloned!')
      qc.invalidateQueries({ queryKey: ['exams'] })
      navigate(`/exams/${exam.id}/edit`)
    },
  })

  if (aLoading || eLoading) return <AppShell title="Dashboard"><PageLoader /></AppShell>

  const exams = examsData?.items || []
  const liveExams = exams.filter(e => e.status === 'live')
  const draftExams = exams.filter(e => e.status === 'draft')

  return (
    <AppShell title="Instructor Dashboard">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Welcome, {firstName} 👋</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {liveExams.length > 0 ? `${liveExams.length} exam(s) currently live` : 'Manage your exams and question bank'}
          </p>
        </div>
        <Link to="/exams/create">
          <Button variant="primary">+ Create Exam</Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Exams" value={analytics?.total_exams || 0} sub={`${draftExams.length} drafts`} icon="📝" color="blue" />
        <StatCard label="Students Evaluated" value={analytics?.total_students || 0} sub="Across all exams" icon="👥" color="green" />
        <StatCard label="Avg Pass Rate" value={`${analytics?.average_pass_rate || 0}%`} sub="All exams" icon="✅" color="amber" />
        <StatCard label="Avg Score" value={`${analytics?.average_score || 0}%`} sub="All students" icon="📊" color="purple" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
        {/* Exam pass rates chart */}
        <Card>
          <CardHeader title="Exam Pass Rates" subtitle="Pass % per exam" />
          {analytics?.exam_stats && analytics.exam_stats.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={analytics.exam_stats.slice(0, 6)} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="exam_title" tick={{ fontSize: 9, fill: '#6b7280' }} tickFormatter={v => v.slice(0, 10) + '…'} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#6b7280' }} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 6 }} formatter={(v: number) => [`${v}%`, 'Pass Rate']} />
                <Bar dataKey="pass_rate" fill="#2563eb" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-sm text-gray-400">No exam data yet</div>
          )}
        </Card>

        {/* Live exams */}
        <Card>
          <CardHeader title="Live Exams" action={<Badge variant="green">● {liveExams.length} active</Badge>} />
          {liveExams.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-400">No live exams right now</div>
          ) : (
            <div className="space-y-3">
              {liveExams.map(exam => (
                <div key={exam.id} className="border border-green-200 bg-green-50 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-1">
                    <div className="font-medium text-sm text-gray-800 truncate">{exam.title}</div>
                    <Badge variant="green">Live</Badge>
                  </div>
                  <div className="text-xs text-gray-500 mb-2">
                    {exam.subject?.name} · {exam.total_marks} marks
                  </div>
                  <div className="flex gap-2">
                    <Link to={`/results/exam/${exam.id}`}>
                      <Button variant="secondary" size="sm">Results</Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* All exams table */}
      <Card>
        <CardHeader
          title="My Exams"
          subtitle={`${exams.length} total`}
          action={<Link to="/exams" className="text-xs text-brand-600 hover:underline font-medium">View all →</Link>}
        />
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Exam</th>
                <th>Subject</th>
                <th>Date</th>
                <th>Marks</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {exams.slice(0, 8).map(exam => (
                <tr key={exam.id}>
                  <td>
                    <div className="font-medium text-gray-800">{exam.title}</div>
                    <div className="text-xs text-gray-400">{exam.duration_minutes} min</div>
                  </td>
                  <td>{exam.subject && <Badge variant="blue">{exam.subject.code}</Badge>}</td>
                  <td className="text-xs text-gray-500">
                    {exam.scheduled_start ? format(new Date(exam.scheduled_start), 'MMM d, yyyy') : '—'}
                  </td>
                  <td>{exam.total_marks}</td>
                  <td><StatusBadge status={exam.status} /></td>
                  <td>
                    <div className="flex gap-1.5">
                      <Link to={`/exams/${exam.id}/edit`}>
                        <Button variant="ghost" size="sm">Edit</Button>
                      </Link>
                      {exam.status === 'draft' && (
                        <Button
                          variant="primary" size="sm"
                          loading={publishMutation.isPending}
                          onClick={() => publishMutation.mutate(exam.id)}
                        >
                          Publish
                        </Button>
                      )}
                      <Button
                        variant="ghost" size="sm"
                        onClick={() => cloneMutation.mutate(exam.id)}
                      >
                        Clone
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </AppShell>
  )
}
