import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { analyticsApi, examsApi, auditApi } from '@/lib/api'
import { AppShell } from '@/components/layout/AppShell'
import { StatCard, Card, CardHeader, StatusBadge, PageLoader, Button, Badge, ProgressBar } from '@/components/ui'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { format } from 'date-fns'

export default function AdminDashboard() {
  const { data: analytics, isLoading: aLoad } = useQuery({
    queryKey: ['analytics', 'admin'],
    queryFn: analyticsApi.admin,
  })

  const { data: examsData, isLoading: eLoad } = useQuery({
    queryKey: ['exams', 'admin', 'all'],
    queryFn: () => examsApi.list({ size: 50 }),
  })

  const { data: auditData } = useQuery({
    queryKey: ['audit-logs', 'recent'],
    queryFn: () => auditApi.list({ size: 10 }),
  })

  if (aLoad || eLoad) return <AppShell title="Admin Console"><PageLoader /></AppShell>

  const exams = examsData?.items || []
  const liveExams = exams.filter(e => e.status === 'live')
  const passFailData = [
    { name: 'Pass', value: analytics?.overall_pass_rate || 0, color: '#16a34a' },
    { name: 'Fail', value: 100 - (analytics?.overall_pass_rate || 0), color: '#dc2626' },
  ]

  return (
    <AppShell title="Admin Console">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Admin Console</h2>
          <p className="text-sm text-gray-500 mt-0.5">Institute-wide examination management</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm">📊 Export Report</Button>
          <Link to="/exams/create"><Button variant="primary" size="sm">+ New Exam</Button></Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 mb-6">
        <StatCard label="Students" value={analytics?.total_students || 0} sub="Enrolled" icon="👥" color="blue" />
        <StatCard label="Instructors" value={analytics?.total_instructors || 0} sub="Active" icon="👨‍🏫" color="green" />
        <StatCard label="Total Exams" value={analytics?.total_exams || 0} sub="All time" icon="📝" color="amber" />
        <StatCard label="Attempts" value={analytics?.total_attempts || 0} sub="Total" icon="📋" color="purple" />
        <StatCard label="Live Now" value={liveExams.length} sub="In progress" icon="⚡" color="red" />
        <StatCard label="Pass Rate" value={`${analytics?.overall_pass_rate || 0}%`} sub="Overall" icon="✅" color="green" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
        {/* Pass/fail donut */}
        <Card>
          <CardHeader title="Overall Pass/Fail" />
          <div className="flex items-center gap-4 mt-2">
            <ResponsiveContainer width="50%" height={130}>
              <PieChart>
                <Pie data={passFailData} cx="50%" cy="50%" innerRadius={35} outerRadius={55} dataKey="value">
                  {passFailData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2.5">
              {passFailData.map(d => (
                <div key={d.name} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: d.color }} />
                  <span className="text-sm text-gray-600">{d.name}: <strong>{d.value}%</strong></span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Top performers */}
        <Card className="col-span-2">
          <CardHeader title="Top Performers" subtitle="Highest scoring students across all exams" />
          <div className="space-y-2.5">
            {(analytics?.top_performers || []).slice(0, 5).map((p, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0
                  ${i === 0 ? 'bg-amber-100 text-amber-700' : i === 1 ? 'bg-gray-100 text-gray-600' : i === 2 ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-500'}`}>
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-800 truncate">{p.student_name}</div>
                  <div className="mt-0.5"><ProgressBar value={p.percentage} color={p.percentage >= 75 ? 'green' : p.percentage >= 50 ? 'blue' : 'amber'} /></div>
                </div>
                <span className="text-sm font-semibold text-gray-700 flex-shrink-0">{p.percentage}%</span>
              </div>
            ))}
            {(!analytics?.top_performers || analytics.top_performers.length === 0) && (
              <div className="text-sm text-gray-400 text-center py-4">No data available</div>
            )}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        {/* Live exam monitoring */}
        <Card>
          <CardHeader
            title="Live Exam Monitoring"
            action={<Badge variant="green">● {liveExams.length} live</Badge>}
          />
          {liveExams.length === 0 ? (
            <div className="py-6 text-center text-sm text-gray-400">No exams in progress</div>
          ) : (
            <div className="space-y-3">
              {liveExams.map(exam => (
                <div key={exam.id} className="border border-gray-100 rounded-xl p-3 hover:border-brand-200 transition-colors">
                  <div className="flex items-center justify-between mb-1">
                    <div className="font-medium text-sm text-gray-800 truncate max-w-[60%]">{exam.title}</div>
                    <StatusBadge status={exam.status} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">{exam.subject?.name || 'General'}</span>
                    <Link to={`/exam-monitoring`}>
                      <Button variant="ghost" size="sm">Monitor →</Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="mt-3">
            <Link to="/exam-monitoring" className="text-xs text-brand-600 hover:underline font-medium">
              View full monitoring dashboard →
            </Link>
          </div>
        </Card>

        {/* Recent audit log */}
        <Card>
          <CardHeader
            title="Recent Activity"
            subtitle="System audit log"
            action={<Link to="/audit-logs" className="text-xs text-brand-600 hover:underline font-medium">Full log →</Link>}
          />
          <div className="space-y-2">
            {(auditData?.items || []).slice(0, 6).map(log => (
              <div key={log.id} className="flex gap-3 py-1.5 border-b border-gray-50 last:border-0">
                <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0
                  ${log.action.includes('tab') ? 'bg-red-500' : log.action.includes('submit') ? 'bg-green-500' : 'bg-brand-400'}`} />
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-gray-700 truncate">{log.description || log.action}</div>
                  <div className="text-[10px] text-gray-400 mt-0.5">
                    {log.ip_address && `${log.ip_address} · `}
                    {format(new Date(log.occurred_at), 'h:mm a')}
                  </div>
                </div>
              </div>
            ))}
            {(!auditData?.items || auditData.items.length === 0) && (
              <div className="text-sm text-gray-400 text-center py-4">No recent activity</div>
            )}
          </div>
        </Card>
      </div>

      {/* All exams table */}
      <Card>
        <CardHeader
          title="All Exams"
          action={<Link to="/exams" className="text-xs text-brand-600 hover:underline font-medium">View all →</Link>}
        />
        <div className="table-container">
          <table className="table">
            <thead>
              <tr><th>Exam</th><th>Subject</th><th>Scheduled</th><th>Marks</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {exams.slice(0, 8).map(exam => (
                <tr key={exam.id}>
                  <td><div className="font-medium text-gray-800">{exam.title}</div></td>
                  <td>{exam.subject && <Badge variant="blue">{exam.subject.code}</Badge>}</td>
                  <td className="text-xs text-gray-500">
                    {exam.scheduled_start ? format(new Date(exam.scheduled_start), 'MMM d, yyyy') : '—'}
                  </td>
                  <td>{exam.total_marks}</td>
                  <td><StatusBadge status={exam.status} /></td>
                  <td>
                    <div className="flex gap-1">
                      <Link to={`/exams/${exam.id}`}><Button variant="ghost" size="sm">View</Button></Link>
                      <Link to={`/results/exam/${exam.id}`}><Button variant="ghost" size="sm">Results</Button></Link>
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
