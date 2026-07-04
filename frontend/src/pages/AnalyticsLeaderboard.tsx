import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { analyticsApi, leaderboardApi, examsApi } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import { AppShell } from '@/components/layout/AppShell'
import {
  Card, CardHeader, StatCard, PageLoader, EmptyState, Avatar,
  ProgressBar, ScoreRing, Badge,
} from '@/components/ui'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PieChart, Pie, Cell,
} from 'recharts'

// ─── Shared colour palette ─────────────────────────────────────────────────
const COLORS = ['#2563eb', '#16a34a', '#d97706', '#dc2626', '#7c3aed', '#0891b2']

// ══════════════════════════════════════════════════════════════════════════════
// LEADERBOARD
// ══════════════════════════════════════════════════════════════════════════════
export function LeaderboardPage() {
  const { data: examsData } = useQuery({
    queryKey: ['exams', 'completed'],
    queryFn: () => examsApi.list({ status: 'completed', size: 20 }),
  })

  const firstExamId = examsData?.items[0]?.id

  const { data: board, isLoading } = useQuery({
    queryKey: ['leaderboard', firstExamId],
    queryFn: () => leaderboardApi.exam(firstExamId!),
    enabled: !!firstExamId,
  })

  const rankBadge = (rank: number) => {
    if (rank === 1) return { bg: 'bg-amber-100 text-amber-700', icon: '🥇' }
    if (rank === 2) return { bg: 'bg-gray-100 text-gray-600', icon: '🥈' }
    if (rank === 3) return { bg: 'bg-orange-100 text-orange-700', icon: '🥉' }
    return { bg: 'bg-gray-100 text-gray-500', icon: String(rank) }
  }

  return (
    <AppShell title="Leaderboard">
      <div className="mb-5">
        <h2 className="text-lg font-bold text-gray-900">Leaderboard</h2>
        <p className="text-sm text-gray-500">Top performers across all examinations</p>
      </div>

      {!firstExamId ? (
        <EmptyState icon="🏆" title="No completed exams yet" description="Rankings will appear after exams are completed and results published." />
      ) : isLoading ? <PageLoader /> : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Top 3 podium */}
          <Card className="lg:col-span-1">
            <CardHeader title="🏆 Top 3" subtitle={board?.exam_title} />
            <div className="space-y-3">
              {(board?.entries || []).slice(0, 3).map(entry => {
                const { bg, icon } = rankBadge(entry.rank)
                return (
                  <div key={entry.rank} className={`flex items-center gap-3 p-3 rounded-xl ${entry.rank === 1 ? 'bg-amber-50 border border-amber-200' : 'bg-gray-50'}`}>
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${bg}`}>
                      {icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-gray-800 truncate">{entry.student_name}</div>
                      <div className="text-xs text-gray-500">{entry.department || '—'}</div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="font-bold text-sm text-gray-900">{entry.percentage}%</div>
                      <div className="text-xs text-gray-400">{entry.score} pts</div>
                    </div>
                  </div>
                )
              })}
            </div>

            {board && (
              <div className="mt-4 pt-3 border-t border-gray-100 text-xs text-gray-400 text-center">
                {board.total_participants} participants total
              </div>
            )}
          </Card>

          {/* Full rankings table */}
          <Card className="lg:col-span-2 p-0 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-800">Full Rankings</h3>
              <p className="text-xs text-gray-500">{board?.exam_title}</p>
            </div>
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Student</th>
                    <th>Dept</th>
                    <th>Score</th>
                    <th>Percentage</th>
                    <th>Percentile</th>
                  </tr>
                </thead>
                <tbody>
                  {(board?.entries || []).map(entry => {
                    const { bg, icon } = rankBadge(entry.rank)
                    return (
                      <tr key={entry.rank}>
                        <td>
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${bg}`}>
                            {icon}
                          </div>
                        </td>
                        <td>
                          <div className="flex items-center gap-2">
                            <Avatar name={entry.student_name} size="sm" />
                            <div>
                              <div className="font-medium text-sm text-gray-800">{entry.student_name}</div>
                              {entry.roll_number && <div className="text-xs text-gray-400">{entry.roll_number}</div>}
                            </div>
                          </div>
                        </td>
                        <td className="text-xs text-gray-500">{entry.department || '—'}</td>
                        <td className="font-semibold">{entry.score}</td>
                        <td>
                          <div className="flex items-center gap-2">
                            <ProgressBar value={entry.percentage}
                              color={entry.percentage >= 75 ? 'green' : entry.percentage >= 50 ? 'blue' : 'amber'}
                              className="w-16" />
                            <span className="text-xs font-medium">{entry.percentage}%</span>
                          </div>
                        </td>
                        <td>
                          {entry.percentile != null && (
                            <span className="text-xs text-purple-700 font-medium">Top {(100 - entry.percentile).toFixed(0)}%</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                  {(!board?.entries || board.entries.length === 0) && (
                    <tr><td colSpan={6} className="text-center py-8 text-sm text-gray-400">No rankings available</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </AppShell>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// ANALYTICS — role-aware
// ══════════════════════════════════════════════════════════════════════════════
export function AnalyticsPage() {
  const { user } = useAuthStore()
  const role = user?.role

  if (role === 'student') return <StudentAnalyticsPage />
  if (role === 'instructor') return <InstructorAnalyticsPage />
  return <AdminAnalyticsPage />
}

// ─── Student Analytics ─────────────────────────────────────────────────────
function StudentAnalyticsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['analytics', 'student'],
    queryFn: analyticsApi.student,
  })

  if (isLoading) return <AppShell title="Analytics"><PageLoader /></AppShell>

  const passRate = data?.total_exams
    ? Math.round((data.exams_passed / data.total_exams) * 100)
    : 0

  return (
    <AppShell title="My Analytics">
      <div className="mb-5">
        <h2 className="text-lg font-bold text-gray-900">My Performance Analytics</h2>
        <p className="text-sm text-gray-500">Detailed breakdown of your examination performance</p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Exams Taken" value={data?.total_exams || 0} icon="📝" color="blue" />
        <StatCard label="Average Score" value={`${data?.average_score || 0}%`} icon="📊" color="green" />
        <StatCard label="Best Score" value={`${data?.best_score || 0}%`} icon="⭐" color="amber" />
        <StatCard label="Pass Rate" value={`${passRate}%`} icon="✅" color="purple" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        {/* Score trend */}
        <Card>
          <CardHeader title="Score Trend" subtitle="Your performance over time" />
          {data?.score_trend && data.score_trend.length > 0 ? (
            <ResponsiveContainer width="100%" height={210}>
              <LineChart data={data.score_trend} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="exam" tick={{ fontSize: 10, fill: '#9ca3af' }} tickFormatter={v => v.slice(0, 12)} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#9ca3af' }} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v: number) => [`${v}%`, 'Score']} />
                <Line type="monotone" dataKey="percentage" stroke="#2563eb" strokeWidth={2.5}
                  dot={{ r: 4, fill: '#2563eb', strokeWidth: 0 }} activeDot={{ r: 6 }} name="Score %" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState icon="📈" title="No data yet" description="Complete exams to see your trend." />
          )}
        </Card>

        {/* Pass/Fail donut */}
        <Card>
          <CardHeader title="Pass / Fail Summary" />
          <div className="flex items-center gap-8 justify-center mt-4">
            <div className="relative">
              <ResponsiveContainer width={140} height={140}>
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Pass', value: data?.exams_passed || 0 },
                      { name: 'Fail', value: data?.exams_failed || 0 },
                    ]}
                    cx="50%" cy="50%" innerRadius={42} outerRadius={60} dataKey="value"
                  >
                    <Cell fill="#16a34a" />
                    <Cell fill="#dc2626" />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-xl font-bold text-gray-900">{passRate}%</div>
                  <div className="text-[10px] text-gray-500">pass rate</div>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500 flex-shrink-0" />
                <span className="text-sm text-gray-600">Passed: <strong className="text-green-700">{data?.exams_passed || 0}</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500 flex-shrink-0" />
                <span className="text-sm text-gray-600">Failed: <strong className="text-red-700">{data?.exams_failed || 0}</strong></span>
              </div>
              <div className="text-xs text-gray-400 mt-2 pt-2 border-t border-gray-100">
                Total: {data?.total_exams || 0} exams
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Subject performance */}
      {data?.subject_performance && data.subject_performance.length > 0 && (
        <Card>
          <CardHeader title="Subject-wise Performance" subtitle="Average score per subject" />
          <div className="space-y-3 mt-2">
            {data.subject_performance.map((sp, i) => (
              <div key={sp.subject_id} className="flex items-center gap-4">
                <div className="text-xs text-gray-500 w-28 truncate">Subject {i + 1}</div>
                <div className="flex-1">
                  <ProgressBar
                    value={sp.avg_percentage}
                    color={sp.avg_percentage >= 75 ? 'green' : sp.avg_percentage >= 50 ? 'blue' : 'amber'}
                  />
                </div>
                <div className="text-sm font-semibold w-12 text-right">{sp.avg_percentage}%</div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </AppShell>
  )
}

// ─── Instructor Analytics ──────────────────────────────────────────────────
function InstructorAnalyticsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['analytics', 'instructor'],
    queryFn: analyticsApi.instructor,
  })

  if (isLoading) return <AppShell title="Analytics"><PageLoader /></AppShell>

  return (
    <AppShell title="Instructor Analytics">
      <div className="mb-5">
        <h2 className="text-lg font-bold text-gray-900">Instructor Analytics</h2>
        <p className="text-sm text-gray-500">Performance overview of your exams and students</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Exams Created" value={data?.total_exams || 0} icon="📝" color="blue" />
        <StatCard label="Students Evaluated" value={data?.total_students || 0} icon="👥" color="green" />
        <StatCard label="Avg Pass Rate" value={`${data?.average_pass_rate || 0}%`} icon="✅" color="amber" />
        <StatCard label="Avg Score" value={`${data?.average_score || 0}%`} icon="📊" color="purple" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card>
          <CardHeader title="Pass Rate by Exam" />
          {data?.exam_stats && data.exam_stats.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.exam_stats} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="exam_title" tick={{ fontSize: 9, fill: '#9ca3af' }} tickFormatter={v => v.slice(0, 12) + '…'} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#9ca3af' }} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v: number) => [`${v}%`]} />
                <Bar dataKey="pass_rate" fill="#2563eb" radius={[4, 4, 0, 0]} name="Pass Rate %" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState icon="📊" title="No exam data" description="Create and publish exams to see analytics." />
          )}
        </Card>

        <Card>
          <CardHeader title="Average Score by Exam" />
          {data?.exam_stats && data.exam_stats.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.exam_stats} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="exam_title" tick={{ fontSize: 9, fill: '#9ca3af' }} tickFormatter={v => v.slice(0, 12) + '…'} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#9ca3af' }} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v: number) => [`${v}%`]} />
                <Bar dataKey="avg_score" fill="#16a34a" radius={[4, 4, 0, 0]} name="Avg Score %" />
              </BarChart>
            </ResponsiveContainer>
          ) : null}
        </Card>
      </div>

      {data?.exam_stats && data.exam_stats.length > 0 && (
        <Card className="mt-5">
          <CardHeader title="Exam-wise Detail" subtitle="Attempts, pass rate and average score" />
          <div className="table-container">
            <table className="table">
              <thead>
                <tr><th>Exam</th><th>Attempts</th><th>Pass Rate</th><th>Avg Score</th><th>Performance</th></tr>
              </thead>
              <tbody>
                {data.exam_stats.map(exam => (
                  <tr key={exam.exam_id}>
                    <td><div className="font-medium text-sm text-gray-800 max-w-xs truncate">{exam.exam_title}</div></td>
                    <td>{exam.attempts}</td>
                    <td>
                      <span className={`badge ${exam.pass_rate >= 70 ? 'badge-green' : exam.pass_rate >= 50 ? 'badge-amber' : 'badge-red'}`}>
                        {exam.pass_rate}%
                      </span>
                    </td>
                    <td>{exam.avg_score}%</td>
                    <td>
                      <ProgressBar value={exam.avg_score}
                        color={exam.avg_score >= 75 ? 'green' : exam.avg_score >= 50 ? 'blue' : 'amber'}
                        className="w-24" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </AppShell>
  )
}

// ─── Admin Analytics ───────────────────────────────────────────────────────
function AdminAnalyticsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['analytics', 'admin'],
    queryFn: analyticsApi.admin,
  })

  if (isLoading) return <AppShell title="Analytics"><PageLoader /></AppShell>

  const passFailData = [
    { name: 'Pass', value: data?.overall_pass_rate || 0, color: '#16a34a' },
    { name: 'Fail', value: 100 - (data?.overall_pass_rate || 0), color: '#dc2626' },
  ]

  return (
    <AppShell title="Institute Analytics">
      <div className="mb-5">
        <h2 className="text-lg font-bold text-gray-900">Institute-wide Analytics</h2>
        <p className="text-sm text-gray-500">Comprehensive performance metrics across the platform</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <StatCard label="Total Students" value={data?.total_students || 0} icon="👥" color="blue" />
        <StatCard label="Instructors" value={data?.total_instructors || 0} icon="👨‍🏫" color="green" />
        <StatCard label="Total Exams" value={data?.total_exams || 0} icon="📝" color="amber" />
        <StatCard label="Total Attempts" value={data?.total_attempts || 0} icon="📋" color="purple" />
        <StatCard label="Overall Pass Rate" value={`${data?.overall_pass_rate || 0}%`} icon="✅" color="green" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
        {/* Pass/Fail donut */}
        <Card>
          <CardHeader title="Overall Pass / Fail" />
          <div className="flex flex-col items-center mt-2">
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie data={passFailData} cx="50%" cy="50%" innerRadius={45} outerRadius={65} dataKey="value">
                  {passFailData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="flex gap-5 mt-2">
              {passFailData.map(d => (
                <div key={d.name} className="flex items-center gap-1.5 text-sm">
                  <div className="w-3 h-3 rounded-full" style={{ background: d.color }} />
                  <span className="text-gray-600">{d.name}: <strong>{d.value}%</strong></span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Top performers */}
        <Card className="lg:col-span-2">
          <CardHeader title="Top Performers" subtitle="Highest scoring students" />
          <div className="space-y-2.5 mt-2">
            {(data?.top_performers || []).slice(0, 6).map((p, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0
                  ${i === 0 ? 'bg-amber-100 text-amber-700' : i === 1 ? 'bg-gray-100 text-gray-600' : 'bg-gray-100 text-gray-500'}`}>
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-800 truncate">{p.student_name}</div>
                  <ProgressBar value={p.percentage}
                    color={p.percentage >= 75 ? 'green' : p.percentage >= 50 ? 'blue' : 'amber'}
                    className="mt-1" />
                </div>
                <span className="text-sm font-semibold w-10 text-right flex-shrink-0">{p.percentage}%</span>
              </div>
            ))}
            {(!data?.top_performers || data.top_performers.length === 0) && (
              <EmptyState icon="🏆" title="No data yet" description="Results will appear here after exams are published." />
            )}
          </div>
        </Card>
      </div>
    </AppShell>
  )
}
