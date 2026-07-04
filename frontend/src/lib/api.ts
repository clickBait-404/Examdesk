import api from '@/lib/axios'
import type {
  AdminAnalytics, AuditLog, AttemptStartResponse, Certificate,
  Exam, ExamListItem, InstructorAnalytics, LeaderboardResponse,
  Notification, Paginated, Question, Result, SavedAnswer,
  StudentAnalytics, Subject, TokenResponse, User,
} from '@/types'

// ─── Auth ──────────────────────────────────────────────────────────────────
export const authApi = {
  login: (email: string, password: string) =>
    api.post<TokenResponse>('/auth/login', { email, password }).then(r => r.data),

  register: (data: {
    email: string; password: string; full_name: string; role: string;
    student_profile?: { roll_number?: string; department?: string }
  }) => api.post<User>('/auth/register', data).then(r => r.data),

  me: () => api.get<User>('/auth/me').then(r => r.data),

  logout: () => api.post('/auth/logout'),

  changePassword: (data: { current_password: string; new_password: string; confirm_password: string }) =>
    api.post('/auth/change-password', data),

  forgotPassword: (email: string) =>
    api.post('/auth/forgot-password', { email }),

  resetPassword: (data: { token: string; new_password: string; confirm_password: string }) =>
    api.post('/auth/reset-password', data),
}

// ─── Users ─────────────────────────────────────────────────────────────────
export const usersApi = {
  list: (params?: { page?: number; size?: number; role?: string; status?: string; search?: string }) =>
    api.get<Paginated<User>>('/users', { params }).then(r => r.data),

  get: (id: string) => api.get<User>(`/users/${id}`).then(r => r.data),

  create: (data: Partial<User> & { password: string }) =>
    api.post<User>('/users', data).then(r => r.data),

  update: (id: string, data: Partial<User>) =>
    api.put<User>(`/users/${id}`, data).then(r => r.data),

  updateStatus: (id: string, status: string) =>
    api.patch<User>(`/users/${id}/status`, null, { params: { new_status: status } }).then(r => r.data),

  delete: (id: string) => api.delete(`/users/${id}`),

  bulkCreate: (users: unknown[]) =>
    api.post('/users/bulk', { users }).then(r => r.data),
}

// ─── Subjects ──────────────────────────────────────────────────────────────
export const subjectsApi = {
  list: () => api.get<Subject[]>('/subjects').then(r => r.data),
  create: (data: Partial<Subject>) => api.post<Subject>('/subjects', data).then(r => r.data),
  update: (id: string, data: Partial<Subject>) => api.put<Subject>(`/subjects/${id}`, data).then(r => r.data),
  delete: (id: string) => api.delete(`/subjects/${id}`),
}

// ─── Questions ─────────────────────────────────────────────────────────────
export const questionsApi = {
  list: (params?: {
    page?: number; size?: number; subject_id?: string;
    difficulty?: string; question_type?: string; search?: string; topic?: string;
  }) => api.get<Paginated<Question>>('/questions', { params }).then(r => r.data),

  get: (id: string) => api.get<Question>(`/questions/${id}`).then(r => r.data),

  create: (data: Partial<Question> & { options: unknown[] }) =>
    api.post<Question>('/questions', data).then(r => r.data),

  update: (id: string, data: Partial<Question>) =>
    api.put<Question>(`/questions/${id}`, data).then(r => r.data),

  delete: (id: string) => api.delete(`/questions/${id}`),
}

// ─── Exams ─────────────────────────────────────────────────────────────────
export const examsApi = {
  list: (params?: { page?: number; size?: number; status?: string; subject_id?: string; search?: string }) =>
    api.get<Paginated<ExamListItem>>('/exams', { params }).then(r => r.data),

  get: (id: string) => api.get<Exam>(`/exams/${id}`).then(r => r.data),

  create: (data: Partial<Exam> & { sections?: unknown[] }) =>
    api.post<Exam>('/exams', data).then(r => r.data),

  update: (id: string, data: Partial<Exam>) =>
    api.put<Exam>(`/exams/${id}`, data).then(r => r.data),

  delete: (id: string) => api.delete(`/exams/${id}`),

  publish: (id: string) => api.post<Exam>(`/exams/${id}/publish`).then(r => r.data),

  clone: (id: string) => api.post<Exam>(`/exams/${id}/clone`).then(r => r.data),

  start: (id: string) => api.post<AttemptStartResponse>(`/exams/${id}/start`).then(r => r.data),
}

// ─── Attempts ──────────────────────────────────────────────────────────────
export const attemptsApi = {
  saveAnswer: (attemptId: string, data: SavedAnswer) =>
    api.post(`/attempts/${attemptId}/answers`, data),

  bulkSaveAnswers: (attemptId: string, answers: SavedAnswer[]) =>
    api.post(`/attempts/${attemptId}/answers/bulk`, { answers }),

  getAnswers: (attemptId: string) =>
    api.get<SavedAnswer[]>(`/attempts/${attemptId}/answers`).then(r => r.data),

  logProctoring: (attemptId: string, event_type: string, description?: string) =>
    api.post(`/attempts/${attemptId}/proctoring`, { event_type, description }),

  submit: (attemptId: string) =>
    api.post<Result>(`/attempts/${attemptId}/submit`).then(r => r.data),
}

// ─── Results ───────────────────────────────────────────────────────────────
export const resultsApi = {
  myResults: (params?: { page?: number; size?: number }) =>
    api.get<Paginated<Result>>('/results/me', { params }).then(r => r.data),

  get: (id: string) => api.get<Result>(`/results/${id}`).then(r => r.data),

  examResults: (examId: string, params?: { page?: number; size?: number }) =>
    api.get<Paginated<Result>>(`/results/exam/${examId}`, { params }).then(r => r.data),

  publish: (id: string) => api.post(`/results/${id}/publish`),

  publishAll: (examId: string) => api.post(`/results/exam/${examId}/publish-all`),
}

// ─── Analytics ─────────────────────────────────────────────────────────────
export const analyticsApi = {
  student: () => api.get<StudentAnalytics>('/analytics/student/me').then(r => r.data),
  instructor: () => api.get<InstructorAnalytics>('/analytics/instructor').then(r => r.data),
  admin: () => api.get<AdminAnalytics>('/analytics/admin').then(r => r.data),
}

// ─── Leaderboard ───────────────────────────────────────────────────────────
export const leaderboardApi = {
  exam: (examId: string) =>
    api.get<LeaderboardResponse>(`/leaderboard/${examId}`).then(r => r.data),
}

// ─── Notifications ─────────────────────────────────────────────────────────
export const notificationsApi = {
  list: (params?: { page?: number; size?: number; unread_only?: boolean }) =>
    api.get<Paginated<Notification>>('/notifications', { params }).then(r => r.data),

  markRead: (id: string) => api.patch(`/notifications/${id}/read`),
  markAllRead: () => api.patch('/notifications/read-all'),
  delete: (id: string) => api.delete(`/notifications/${id}`),
}

// ─── Certificates ──────────────────────────────────────────────────────────
export const certificatesApi = {
  mine: () => api.get<Paginated<Certificate>>('/certificates/me').then(r => r.data),
  verify: (code: string) => api.get(`/certificates/verify/${code}`).then(r => r.data),
}

// ─── Audit Logs ────────────────────────────────────────────────────────────
export const auditApi = {
  list: (params?: { page?: number; size?: number; action?: string }) =>
    api.get<Paginated<AuditLog>>('/audit-logs', { params }).then(r => r.data),
}
