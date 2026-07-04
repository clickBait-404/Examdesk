// ─── Auth ──────────────────────────────────────────────────────────────────
export type Role = 'student' | 'instructor' | 'admin'

export interface User {
  id: string
  email: string
  full_name: string
  role: Role
  status: string
  phone?: string
  profile_picture?: string
  last_login_at?: string
  created_at: string
  student_profile?: StudentProfile
  instructor_profile?: InstructorProfile
}

export interface StudentProfile {
  id: string
  user_id: string
  roll_number?: string
  department?: string
  semester?: number
  batch_year?: number
}

export interface InstructorProfile {
  id: string
  user_id: string
  department?: string
  designation?: string
  employee_id?: string
  specialization?: string
}

export interface TokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
  expires_in: number
  user: User
}

// ─── Subjects ──────────────────────────────────────────────────────────────
export interface Subject {
  id: string
  name: string
  code: string
  description?: string
  department?: string
  credits?: number
  is_active: boolean
  created_at: string
}

// ─── Questions ─────────────────────────────────────────────────────────────
export type QuestionType = 'mcq' | 'true_false' | 'multi_select' | 'fill_blank' | 'subjective' | 'descriptive'
export type Difficulty = 'easy' | 'medium' | 'hard'

export interface QuestionOption {
  id: string
  text: string
  is_correct: boolean
  order_index: number
  image_url?: string
}

export interface Question {
  id: string
  text: string
  question_type: QuestionType
  difficulty: Difficulty
  topic?: string
  tags: string[]
  explanation?: string
  image_url?: string
  subject_id?: string
  is_active: boolean
  version: number
  created_at: string
  options: QuestionOption[]
}

// student view — no is_correct
export interface QuestionForStudent {
  id: string
  text: string
  question_type: QuestionType
  image_url?: string
  marks: number
  order_index: number
  options: { id: string; text: string; order_index: number }[]
}

// ─── Exams ─────────────────────────────────────────────────────────────────
export type ExamStatus = 'draft' | 'published' | 'live' | 'completed' | 'cancelled'

export interface ExamSection {
  id: string
  name: string
  description?: string
  order_index: number
  marks: number
  time_limit_minutes?: number
}

export interface Exam {
  id: string
  title: string
  description?: string
  instructions?: string
  status: ExamStatus
  duration_minutes: number
  scheduled_start?: string
  scheduled_end?: string
  total_marks: number
  passing_marks: number
  negative_marking: boolean
  negative_marks_per_wrong: number
  randomize_questions: boolean
  randomize_options: boolean
  show_result_immediately: boolean
  allow_review: boolean
  max_attempts: number
  full_screen_required: boolean
  tab_switch_detection: boolean
  copy_paste_disabled: boolean
  max_tab_switches_allowed: number
  subject_id?: string
  instructor_id?: string
  created_at: string
  sections: ExamSection[]
  subject?: Subject
}

export interface ExamListItem {
  id: string
  title: string
  status: ExamStatus
  duration_minutes: number
  scheduled_start?: string
  total_marks: number
  passing_marks: number
  subject?: Subject
  created_at: string
}

// ─── Attempts ──────────────────────────────────────────────────────────────
export interface SectionForAttempt {
  id: string
  name: string
  marks: number
  time_limit_minutes?: number
  questions: QuestionForStudent[]
}

export interface AttemptStartResponse {
  attempt_id: string
  exam_id: string
  exam_title: string
  duration_minutes: number
  total_marks: number
  negative_marking: boolean
  negative_marks_per_wrong: number
  full_screen_required: boolean
  tab_switch_detection: boolean
  copy_paste_disabled: boolean
  max_tab_switches_allowed: number
  started_at: string
  ends_at: string
  sections: SectionForAttempt[]
}

export interface SavedAnswer {
  question_id: string
  selected_option_id?: string
  selected_option_ids?: string[]
  text_answer?: string
  is_marked_for_review: boolean
}

// ─── Results ───────────────────────────────────────────────────────────────
export interface Result {
  id: string
  exam_id: string
  student_id: string
  attempt_id: string
  total_marks: number
  obtained_marks: number
  percentage: number
  is_passed: boolean
  rank?: number
  correct_answers: number
  wrong_answers: number
  unattempted: number
  negative_marks: number
  section_scores: Record<string, number>
  is_published: boolean
  published_at?: string
  created_at: string
  exam?: ExamListItem
  question_wise?: {
    question_id: string
    question_text: string
    is_correct: boolean | null
    marks_awarded: number | null
  }[]
}

// ─── Analytics ─────────────────────────────────────────────────────────────
export interface StudentAnalytics {
  total_exams: number
  exams_passed: number
  exams_failed: number
  average_score: number
  best_score: number
  current_rank?: number
  score_trend: { exam: string; score: number; percentage: number; date: string }[]
  subject_performance: { subject_id: string; avg_percentage: number }[]
}

export interface InstructorAnalytics {
  total_exams: number
  total_students: number
  average_pass_rate: number
  average_score: number
  exam_stats: { exam_id: string; exam_title: string; attempts: number; pass_rate: number; avg_score: number }[]
}

export interface AdminAnalytics {
  total_students: number
  total_instructors: number
  total_exams: number
  total_attempts: number
  overall_pass_rate: number
  top_performers: { student_name: string; percentage: number }[]
}

// ─── Leaderboard ───────────────────────────────────────────────────────────
export interface LeaderboardEntry {
  rank: number
  student_name: string
  roll_number?: string
  department?: string
  score: number
  percentage: number
  percentile?: number
}

export interface LeaderboardResponse {
  exam_id: string
  exam_title: string
  entries: LeaderboardEntry[]
  total_participants: number
}

// ─── Notifications ─────────────────────────────────────────────────────────
export interface Notification {
  id: string
  type: string
  title: string
  message: string
  is_read: boolean
  read_at?: string
  created_at: string
  metadata: Record<string, string>
}

// ─── Certificates ──────────────────────────────────────────────────────────
export interface Certificate {
  id: string
  student_id: string
  result_id: string
  verification_code: string
  issued_at: string
  pdf_url?: string
  is_valid: boolean
}

// ─── Pagination ────────────────────────────────────────────────────────────
export interface Paginated<T> {
  items: T[]
  total: number
  page: number
  size: number
  pages: number
}

// ─── Audit ─────────────────────────────────────────────────────────────────
export interface AuditLog {
  id: string
  user_id?: string
  action: string
  resource_type?: string
  resource_id?: string
  description?: string
  ip_address?: string
  occurred_at: string
}
