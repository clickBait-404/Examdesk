import { ReactNode, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth'
import { authApi } from '@/lib/api'
import { Avatar } from '@/components/ui'
import { clsx } from 'clsx'
import type { Role } from '@/types'

// ─── Nav config per role ───────────────────────────────────────────────────
const NAV: Record<Role, { section: string; items: { to: string; icon: string; label: string; badge?: number }[] }[]> = {
  student: [
    {
      section: 'Dashboard',
      items: [
        { to: '/dashboard',    icon: '📊', label: 'Dashboard' },
        { to: '/exams',        icon: '📅', label: 'My Exams' },
        { to: '/results',      icon: '📋', label: 'My Results' },
      ],
    },
    {
      section: 'Performance',
      items: [
        { to: '/analytics',    icon: '📈', label: 'Analytics' },
        { to: '/leaderboard',  icon: '🏆', label: 'Leaderboard' },
        { to: '/certificates', icon: '🎓', label: 'Certificates' },
      ],
    },
    {
      section: 'Account',
      items: [
        { to: '/notifications', icon: '🔔', label: 'Notifications', badge: 2 },
        { to: '/profile',       icon: '👤', label: 'Profile' },
      ],
    },
  ],
  instructor: [
    {
      section: 'Dashboard',
      items: [
        { to: '/dashboard',     icon: '📊', label: 'Dashboard' },
        { to: '/exams',         icon: '📝', label: 'My Exams' },
        { to: '/exams/create',  icon: '➕', label: 'Create Exam' },
      ],
    },
    {
      section: 'Content',
      items: [
        { to: '/questions',  icon: '🗄️', label: 'Question Bank' },
        { to: '/subjects',   icon: '📚', label: 'Subjects' },
        { to: '/results',    icon: '📊', label: 'Results' },
      ],
    },
    {
      section: 'Analytics',
      items: [
        { to: '/analytics', icon: '📈', label: 'Analytics' },
        { to: '/students',  icon: '👥', label: 'Students' },
      ],
    },
  ],
  admin: [
    {
      section: 'Dashboard',
      items: [
        { to: '/dashboard',        icon: '📊', label: 'Dashboard' },
        { to: '/exam-monitoring',  icon: '👁️', label: 'Live Monitor' },
      ],
    },
    {
      section: 'Management',
      items: [
        { to: '/users',     icon: '👥', label: 'Users' },
        { to: '/exams',     icon: '📝', label: 'All Exams' },
        { to: '/questions', icon: '🗄️', label: 'Question Bank' },
        { to: '/subjects',  icon: '📚', label: 'Subjects' },
      ],
    },
    {
      section: 'Reports',
      items: [
        { to: '/analytics',  icon: '📈', label: 'Analytics' },
        { to: '/audit-logs', icon: '🔍', label: 'Audit Logs' },
      ],
    },
  ],
}

// ─── Sidebar ───────────────────────────────────────────────────────────────
function Sidebar({ role }: { role: Role }) {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const nav = NAV[role]

  async function handleLogout() {
    try { await authApi.logout() } catch {}
    logout()
    navigate('/login')
  }

  return (
    <aside className="fixed top-0 left-0 h-screen w-60 bg-white border-r border-gray-200 flex flex-col z-40 overflow-y-auto">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-4 border-b border-gray-100">
        <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
          ED
        </div>
        <div>
          <div className="text-sm font-semibold text-gray-900">ExamDesk</div>
          <div className="text-xs text-gray-400">
            {role === 'student' ? 'Student Portal' : role === 'instructor' ? 'Instructor Portal' : 'Admin Console'}
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-2">
        {nav.map(({ section, items }) => (
          <div key={section}>
            <div className="px-4 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
              {section}
            </div>
            {items.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/dashboard'}
                className={({ isActive }) =>
                  clsx('nav-item mx-2 w-auto', isActive && 'active')
                }
              >
                <span className="text-base w-5 text-center">{item.icon}</span>
                <span className="flex-1">{item.label}</span>
                {item.badge && (
                  <span className="ml-auto bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                    {item.badge}
                  </span>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* User footer */}
      <div className="border-t border-gray-100 p-3">
        <div className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
          <Avatar name={user?.full_name || 'U'} size="sm" />
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-gray-800 truncate">{user?.full_name}</div>
            <div className="text-[10px] text-gray-400 capitalize">{user?.role}</div>
          </div>
          <button onClick={handleLogout} className="text-gray-400 hover:text-gray-600 text-xs px-1" title="Logout">↩</button>
        </div>
      </div>
    </aside>
  )
}

// ─── Topbar ────────────────────────────────────────────────────────────────
function Topbar({ title }: { title?: string }) {
  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center px-6 gap-4 sticky top-0 z-30">
      <div className="flex-1">
        {title && <h1 className="text-base font-semibold text-gray-900">{title}</h1>}
      </div>
      <div className="flex items-center gap-2">
        <NavLink to="/notifications" className="relative p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg">
          🔔
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full" />
        </NavLink>
        <NavLink to="/profile" className="p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg">
          👤
        </NavLink>
      </div>
    </header>
  )
}

// ─── App Shell ─────────────────────────────────────────────────────────────
export function AppShell({ children, title }: { children: ReactNode; title?: string }) {
  const { user } = useAuthStore()
  if (!user) return null

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar role={user.role as Role} />
      <div className="flex-1 flex flex-col" style={{ marginLeft: 240 }}>
        <Topbar title={title} />
        <main className="flex-1 p-6 animate-fade-in">
          {children}
        </main>
      </div>
    </div>
  )
}
