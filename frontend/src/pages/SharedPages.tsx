import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, Navigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { resultsApi, notificationsApi, usersApi, authApi } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import { AppShell } from '@/components/layout/AppShell'
import {
  Card, CardHeader, Button, Badge, ScoreRing, PageLoader,
  EmptyState, Avatar, StatCard, Tabs, Input, Select, SearchBar, Modal,
} from '@/components/ui'
import type { Result } from '@/types'
import { useForm } from 'react-hook-form'

// ─── My Results ────────────────────────────────────────────────────────────
export function MyResultsPage() {
  const role = useAuthStore(s => s.user?.role)
  const isStudent = !role || role === 'student'

  // This page calls the student-only "my results" endpoint, which requires
  // a StudentProfile record. Instructors/admins don't have one, so sending
  // them here (e.g. via the instructor sidebar's "Results" link) previously
  // crashed with "Student profile not found". Instructors already have a
  // per-exam "Results" link on their Dashboard/exam list, so send them there
  // instead of rendering a page built for students.
  const { data, isLoading } = useQuery({
    queryKey: ['results', 'me'],
    queryFn: () => resultsApi.myResults({ size: 20 }),
    enabled: isStudent,
  })

  if (!isStudent) {
    return <Navigate to="/exams" replace />
  }

  return (
    <AppShell title="My Results">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">My Results</h2>
          <p className="text-sm text-gray-500">{data?.total || 0} exam results</p>
        </div>
      </div>

      {isLoading ? <PageLoader /> : (
        <>
          {(data?.items || []).length === 0 ? (
            <EmptyState icon="📋" title="No results yet" description="Attempt an exam to see your results here." />
          ) : (
            <div className="table-container card p-0 overflow-hidden">
              <table className="table">
                <thead>
                  <tr><th>Exam</th><th>Score</th><th>Percentage</th><th>Status</th><th>Rank</th><th>Date</th><th></th></tr>
                </thead>
                <tbody>
                  {(data?.items || []).map((r: Result) => {
                    const pct = Math.round(r.percentage)
                    return (
                      <tr key={r.id}>
                        <td>
                          <div className="font-medium text-gray-800">{r.exam?.title || 'Exam'}</div>
                        </td>
                        <td>
                          <div className="flex items-center gap-2">
                            <ScoreRing pct={pct} size={40} />
                            <span className="font-semibold text-sm">{r.obtained_marks}/{r.total_marks}</span>
                          </div>
                        </td>
                        <td className="font-medium">{pct}%</td>
                        <td>
                          <span className={`badge ${r.is_passed ? 'badge-green' : 'badge-red'}`}>
                            {r.is_passed ? '✓ Pass' : '✗ Fail'}
                          </span>
                        </td>
                        <td>{r.rank ? <span className="font-bold text-brand-600">#{r.rank}</span> : '—'}</td>
                        <td className="text-xs text-gray-500">{format(new Date(r.created_at), 'MMM d, yyyy')}</td>
                        <td><Link to={`/results/${r.id}`}><Button variant="ghost" size="sm">View →</Button></Link></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </AppShell>
  )
}

// ─── Notifications ─────────────────────────────────────────────────────────
export function NotificationsPage() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationsApi.list({ size: 30 }),
  })

  const markAllMutation = useMutation({
    mutationFn: notificationsApi.markAllRead,
    onSuccess: () => { toast.success('All marked as read'); qc.invalidateQueries({ queryKey: ['notifications'] }) },
  })

  const markReadMutation = useMutation({
    mutationFn: notificationsApi.markRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const typeIcon: Record<string, string> = {
    exam_scheduled: '📅', exam_reminder: '⏰', result_published: '📊',
    certificate_issued: '🎓', announcement: '📢', system: 'ℹ️',
  }

  return (
    <AppShell title="Notifications">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Notifications</h2>
          <p className="text-sm text-gray-500">{data?.items.filter(n => !n.is_read).length || 0} unread</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => markAllMutation.mutate()} loading={markAllMutation.isPending}>
          Mark all as read
        </Button>
      </div>

      {isLoading ? <PageLoader /> : (
        <div className="space-y-2 max-w-2xl">
          {(data?.items || []).length === 0 ? (
            <EmptyState icon="🔔" title="No notifications" description="You're all caught up!" />
          ) : (
            (data?.items || []).map(n => (
              <div key={n.id} onClick={() => !n.is_read && markReadMutation.mutate(n.id)}
                className={`card p-4 flex gap-3 cursor-pointer transition-all ${
                  !n.is_read ? 'border-l-4 border-l-brand-500 bg-blue-50/40' : 'hover:bg-gray-50'
                }`}>
                <span className="text-xl flex-shrink-0">{typeIcon[n.type] || '🔔'}</span>
                <div className="flex-1">
                  <div className={`text-sm ${!n.is_read ? 'font-medium text-gray-900' : 'text-gray-700'}`}>{n.title}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{n.message}</div>
                  <div className="text-xs text-gray-400 mt-1">{format(new Date(n.created_at), 'MMM d, h:mm a')}</div>
                </div>
                {!n.is_read && <div className="w-2 h-2 rounded-full bg-brand-500 flex-shrink-0 mt-1.5" />}
              </div>
            ))
          )}
        </div>
      )}
    </AppShell>
  )
}

// ─── User Management (Admin) ───────────────────────────────────────────────
export function UserManagementPage() {
  const qc = useQueryClient()
  const [tab, setTab] = useState('student')
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['users', tab, search],
    queryFn: () => usersApi.list({ role: tab, search: search || undefined, size: 30 }),
  })

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => usersApi.updateStatus(id, status),
    onSuccess: () => { toast.success('Status updated'); qc.invalidateQueries({ queryKey: ['users'] }) },
  })

  return (
    <AppShell title="User Management">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-bold text-gray-900">User Management</h2>
          <p className="text-sm text-gray-500">{data?.total || 0} {tab}s</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm">📤 Bulk Upload</Button>
          <Button variant="primary" size="sm" onClick={() => setShowCreate(true)}>+ Add User</Button>
        </div>
      </div>

      <Tabs
        tabs={[{ key: 'student', label: 'Students' }, { key: 'instructor', label: 'Instructors' }, { key: 'admin', label: 'Admins' }]}
        active={tab}
        onChange={setTab}
      />

      <div className="flex gap-3 mb-4">
        <SearchBar value={search} onChange={setSearch} placeholder="Search by name or email…" />
      </div>

      {isLoading ? <PageLoader /> : (
        <div className="card overflow-hidden p-0">
          <table className="table">
            <thead>
              <tr><th>User</th><th>Email</th><th>Dept / Role</th><th>Status</th><th>Joined</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {(data?.items || []).map(u => (
                <tr key={u.id}>
                  <td>
                    <div className="flex items-center gap-2">
                      <Avatar name={u.full_name} size="sm" />
                      <div>
                        <div className="font-medium text-sm text-gray-800">{u.full_name}</div>
                        <div className="text-xs text-gray-400">{u.student_profile?.roll_number || u.instructor_profile?.employee_id || ''}</div>
                      </div>
                    </div>
                  </td>
                  <td className="text-xs text-gray-500">{u.email}</td>
                  <td className="text-xs">{u.student_profile?.department || u.instructor_profile?.designation || u.role}</td>
                  <td>
                    <span className={`badge ${u.status === 'active' ? 'badge-green' : u.status === 'suspended' ? 'badge-red' : 'badge-gray'}`}>
                      {u.status}
                    </span>
                  </td>
                  <td className="text-xs text-gray-500">{format(new Date(u.created_at), 'MMM d, yyyy')}</td>
                  <td>
                    <div className="flex gap-1">
                      {u.status === 'active'
                        ? <Button variant="ghost" size="sm" className="text-red-500" onClick={() => statusMutation.mutate({ id: u.id, status: 'suspended' })}>Suspend</Button>
                        : <Button variant="ghost" size="sm" className="text-green-600" onClick={() => statusMutation.mutate({ id: u.id, status: 'active' })}>Activate</Button>
                      }
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {(data?.items || []).length === 0 && (
            <EmptyState icon="👥" title={`No ${tab}s found`} description="Try a different search term." />
          )}
        </div>
      )}
    </AppShell>
  )
}

// ─── Profile Page ─────────────────────────────────────────────────────────
export function ProfilePage() {
  const { user, setUser } = useAuthStore()
  const qc = useQueryClient()
  const [pwModal, setPwModal] = useState(false)

  const { register: regPw, handleSubmit: handlePw, formState: { errors: pwErr }, reset: resetPw } = useForm<{
    current_password: string; new_password: string; confirm_password: string
  }>()

  const updateMutation = useMutation({
    mutationFn: (data: { full_name: string; phone: string }) => usersApi.update(user!.id, data),
    onSuccess: (updated) => { setUser(updated); toast.success('Profile updated!') },
  })

  const changePwMutation = useMutation({
    mutationFn: authApi.changePassword,
    onSuccess: () => { toast.success('Password changed!'); setPwModal(false); resetPw() },
  })

  const { register, handleSubmit } = useForm({ defaultValues: { full_name: user?.full_name || '', phone: user?.phone || '' } })

  if (!user) return null

  return (
    <AppShell title="My Profile">
      <div className="max-w-3xl">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Avatar & quick stats */}
          <Card className="lg:col-span-1">
            <div className="text-center py-4">
              <Avatar name={user.full_name} size="lg" />
              <div className="text-base font-bold text-gray-900 mt-3">{user.full_name}</div>
              <div className="text-sm text-gray-500 capitalize">{user.role}</div>
              <span className="badge badge-green mt-2">● Active</span>
            </div>
            <div className="border-t border-gray-100 pt-4 space-y-2.5 text-sm">
              {[
                ['Email', user.email],
                ['Role', user.role],
                ['Department', user.student_profile?.department || user.instructor_profile?.department || '—'],
                ['Member Since', format(new Date(user.created_at), 'MMM yyyy')],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <span className="text-gray-500">{k}</span>
                  <span className="font-medium text-gray-800 truncate ml-2">{v}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Edit form */}
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardHeader title="Personal Information" />
              <form onSubmit={handleSubmit(d => updateMutation.mutate(d))} className="space-y-4">
                <Input label="Full Name" {...register('full_name')} />
                <Input label="Phone Number" type="tel" placeholder="+91 98765 43210" {...register('phone')} />
                <Button type="submit" variant="primary" size="sm" loading={updateMutation.isPending}>Save Changes</Button>
              </form>
            </Card>

            <Card>
              <CardHeader title="Security" />
              <Button variant="secondary" size="sm" onClick={() => setPwModal(true)}>🔒 Change Password</Button>
            </Card>
          </div>
        </div>
      </div>

      <Modal open={pwModal} onClose={() => setPwModal(false)} title="Change Password"
        footer={
          <>
            <Button variant="secondary" onClick={() => setPwModal(false)}>Cancel</Button>
            <Button variant="primary" loading={changePwMutation.isPending} onClick={handlePw(d => changePwMutation.mutate(d))}>Update Password</Button>
          </>
        }
      >
        <div className="space-y-3">
          <Input label="Current Password" type="password" error={pwErr.current_password?.message} {...regPw('current_password', { required: 'Required' })} />
          <Input label="New Password" type="password" error={pwErr.new_password?.message} {...regPw('new_password', { required: 'Required', minLength: { value: 8, message: 'Min 8 characters' } })} />
          <Input label="Confirm New Password" type="password" error={pwErr.confirm_password?.message} {...regPw('confirm_password', { required: 'Required' })} />
        </div>
      </Modal>
    </AppShell>
  )
}
