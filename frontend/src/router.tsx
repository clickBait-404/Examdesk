import RegisterPage from '@/pages/RegisterPage'
import { createBrowserRouter, RouterProvider, Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth'
import type { Role } from '@/types'

import LoginPage from '@/pages/LoginPage'
import StudentDashboard from '@/pages/student/Dashboard'
import ExamPage from '@/pages/student/ExamPage'
import InstructorDashboard from '@/pages/instructor/Dashboard'
import AdminDashboard from '@/pages/admin/Dashboard'
import CreateExamPage from '@/pages/instructor/CreateExam'
import { MyResultsPage, NotificationsPage, UserManagementPage, ProfilePage } from '@/pages/SharedPages'
import QuestionBankPage from '@/pages/QuestionBankPage'
import { AnalyticsPage, LeaderboardPage } from '@/pages/AnalyticsLeaderboard'
import { ExamsListPage, ExamResultsPage, SubjectsPage, AuditLogsPage } from '@/pages/OtherPages'
import { CertificatesPage, ResultDetailPage } from '@/pages/CertificatesAndResults'
import { AppShell } from '@/components/layout/AppShell'
import { EmptyState } from '@/components/ui'

function RequireAuth({ allowedRoles }: { allowedRoles?: Role[] }) {
  const { isAuthenticated, user } = useAuthStore()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role as Role)) {
    return <Navigate to="/dashboard" replace />
  }

  return <Outlet />
}

function RedirectIfAuth() {
  const { isAuthenticated } = useAuthStore()
  return isAuthenticated ? <Navigate to="/dashboard" replace /> : <Outlet />
}

function DashboardRedirect() {
  const { user } = useAuthStore()

  switch (user?.role) {
    case 'student':
      return <StudentDashboard />
    case 'instructor':
      return <InstructorDashboard />
    default:
      return <AdminDashboard />
  }
}

function PlaceholderPage({ title }: { title: string }) {
  return (
    <AppShell title={title}>
      <EmptyState
        icon="🚧"
        title={title}
        description="This page is still under development."
      />
    </AppShell>
  )
}

const router = createBrowserRouter([
  {
    element: <RedirectIfAuth />,
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/register', element: <RegisterPage  /> },
    ],
  },

  {
    element: <RequireAuth />,
    children: [
      { path: '/dashboard', element: <DashboardRedirect /> },

      // Exam routes
      { path: '/exam/:examId/start', element: <ExamPage /> },
      { path: '/exams/:examId', element: <ExamPage /> },

      // Student
      {
        element: <RequireAuth allowedRoles={['student']} />,
        children: [
          { path: '/leaderboard', element: <LeaderboardPage /> },
          { path: '/certificates', element: <CertificatesPage /> },
        ],
      },

      // Instructor/Admin
      {
        element: <RequireAuth allowedRoles={['instructor', 'admin']} />,
        children: [
          { path: '/exams/create', element: <CreateExamPage /> },
          { path: '/exams/:examId/edit', element: <CreateExamPage /> },
          { path: '/results/exam/:examId', element: <ExamResultsPage /> },
          { path: '/students', element: <UserManagementPage /> },
        ],
      },

      // Admin
      {
        element: <RequireAuth allowedRoles={['admin']} />,
        children: [
          { path: '/users', element: <UserManagementPage /> },
          { path: '/audit-logs', element: <AuditLogsPage /> },
          { path: '/exam-monitoring', element: <PlaceholderPage title="Live Exam Monitoring" /> },
        ],
      },

      // Shared
      { path: '/exams', element: <ExamsListPage /> },
      { path: '/results', element: <MyResultsPage /> },
      { path: '/results/:resultId', element: <ResultDetailPage /> },
      { path: '/questions', element: <QuestionBankPage /> },
      { path: '/subjects', element: <SubjectsPage /> },
      { path: '/analytics', element: <AnalyticsPage /> },
      { path: '/notifications', element: <NotificationsPage /> },
      { path: '/profile', element: <ProfilePage /> },
    ],
  },

  {
    path: '/',
    element: <Navigate to="/dashboard" replace />,
  },

  {
    path: '*',
    element: <Navigate to="/dashboard" replace />,
  },
])

export default function AppRouter() {
  return <RouterProvider router={router} />
}