import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { analyticsApi, examsApi } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import { AppShell } from '@/components/layout/AppShell'
import { StatCard, Card, CardHeader, StatusBadge, PageLoader, ScoreRing, Button, ProgressBar } from '@/components/ui'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { format } from 'date-fns'

export default function StudentDashboard() {
  const { user } = useAuthStore()
  const firstName = user?.full_name?.split(' ')[0] || 'Student'

  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ['analytics', 'student'],
    queryFn: analyticsApi.student,
  })

  const { data: examsData, isLoading: examsLoading } = useQuery({
    queryKey: ['exams', 'student'],
    queryFn: () => examsApi.list({ size: 5 }),
  })

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  if (analyticsLoading || examsLoading) return <AppShell title="Dashboard"><PageLoader /></AppShell>

  const upcomingExams = examsData?.items.filter(e => e.status !== 'completed') || []
  const liveExams = examsData?.items.filter(e => e.status === 'live') || []

  return (
    <AppShell title="Dashboard">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">{greeting}, {firstName} 👋</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {liveExams.length > 0
              ? `You have ${liveExams.length} live exam${liveExams.length > 1 ? 's' : ''} right now!`
              : 'Here your exam overview for today.'}
          </p>
        </div>
        {liveExams.length > 0 && (
          <Link to={`/exam/${liveExams[0].id}/start`}>
            <Button variant="success" size="md">🚀 Start Live Exam</Button>
          </Link>
        )}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Exams Attempted" value={analytics?.total_exams || 0} sub="Total attempts" icon="📝" color="blue" />
        <StatCard label="Average Score" value={`${analytics?.average_score || 0}%`} sub="Across all exams" icon="📈" color="green" />
        <StatCard label="Best Score" value={`${analytics?.best_score || 0}%`} sub="Personal best" icon="⭐" color="amber" />
        <StatCard label="Current Rank" value={analytics?.current_rank ? `#${analytics.current_rank}` : '—'} sub="Latest exam" icon="🏆" color="purple" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
        <Card>
          <CardHeader title="Score Trend" subtitle="Your performance over recent exams" />
          {analytics?.score_trend && analytics.score_trend.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={analytics.score_trend} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="exam" tick={{ fontSize: 11, fill: '#6b7280' }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#6b7280' }} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 6 }} />
                <Line type="monotone" dataKey="percentage" stroke="#2563eb" strokeWidth={2.5} dot={{ r: 4, fill: '#2563eb' }} name="Score %" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-sm text-gray-400">No data yet — attempt an exam to see trends</div>
          )}
        </Card>

        <Card>
          <CardHeader title="Pass / Fail Breakdown" subtitle="Across all exams taken" />
          <div className="flex items-center gap-6 mt-4">
            <ScoreRing pct={analytics?.total_exams ? Math.round((analytics.exams_passed / analytics.total_exams) * 100) : 0} size={100} />
            <div className="space-y-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <span className="text-sm text-gray-600">Passed: <strong>{analytics?.exams_passed || 0}</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <span className="text-sm text-gray-600">Failed: <strong>{analytics?.exams_failed || 0}</strong></span>
                </div>
              </div>
              <div className="text-xs text-gray-500 bg-green-50 rounded-lg px-3 py-2">
                Pass rate: <strong className="text-green-700">
                  {analytics?.total_exams ? Math.round((analytics.exams_passed / analytics.total_exams) * 100) : 0}%
                </strong>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Upcoming exams table */}
      <Card>
        <CardHeader
          title="Upcoming & Live Exams"
          subtitle="Your scheduled examinations"
          action={<Link to="/exams" className="text-xs text-brand-600 hover:underline font-medium">View all →</Link>}
        />
        {upcomingExams.length === 0 ? (
          <div className="text-center py-8 text-sm text-gray-400">No upcoming exams scheduled</div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Exam</th>
                  <th>Subject</th>
                  <th>Scheduled</th>
                  <th>Duration</th>
                  <th>Marks</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {upcomingExams.map(exam => (
                  <tr key={exam.id}>
                    <td>
                      <div className="font-medium text-gray-800">{exam.title}</div>
                    </td>
                    <td>
                      {exam.subject && <span className="badge badge-blue">{exam.subject.name}</span>}
                    </td>
                    <td className="text-xs text-gray-500">
                      {exam.scheduled_start
                        ? format(new Date(exam.scheduled_start), 'MMM d, h:mm a')
                        : '—'}
                    </td>
                    <td>{exam.duration_minutes} min</td>
                    <td>{exam.total_marks}</td>
                    <td><StatusBadge status={exam.status} /></td>
                    <td>
                      {exam.status === 'live'
                        ? <Link to={`/exam/${exam.id}/start`}><Button variant="success" size="sm">Start →</Button></Link>
                        : <Link to={`/exams/${exam.id}`}><Button variant="secondary" size="sm">Details</Button></Link>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </AppShell>
  )
}
