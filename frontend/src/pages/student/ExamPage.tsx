import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { clsx } from 'clsx'
import { examsApi, attemptsApi } from '@/lib/api'
import { Spinner, Modal, Button, ScoreRing } from '@/components/ui'
import type { AttemptStartResponse, QuestionForStudent, SavedAnswer, Result } from '@/types'

// ─── Timer ─────────────────────────────────────────────────────────────────
function useCountdown(endsAt: string, onExpire: () => void) {
  const [secondsLeft, setSecondsLeft] = useState(() =>
    Math.max(0, Math.floor((new Date(endsAt).getTime() - Date.now()) / 1000))
  )
  // Keep a ref to the latest onExpire so the interval (set up once) always
  // calls the most recent handler instead of the one captured on mount —
  // otherwise it fires with stale state (e.g. an empty answers object).
  const onExpireRef = useRef(onExpire)
  useEffect(() => { onExpireRef.current = onExpire }, [onExpire])

  useEffect(() => {
    if (secondsLeft <= 0) { onExpireRef.current(); return }
    const t = setInterval(() => {
      setSecondsLeft(s => {
        if (s <= 1) { clearInterval(t); onExpireRef.current(); return 0 }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(t)
  }, [])
  const mins = Math.floor(secondsLeft / 60)
  const secs = secondsLeft % 60
  return { secondsLeft, display: `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}` }
}

// ─── Q-nav button ──────────────────────────────────────────────────────────
type QStatus = 'unanswered' | 'answered' | 'marked' | 'answered-marked' | 'current'
function QNavBtn({ n, status, onClick }: { n: number; status: QStatus; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'w-9 h-9 rounded-lg border-2 text-xs font-semibold transition-all',
        status === 'answered'         && 'bg-brand-600 border-brand-600 text-white',
        status === 'marked'           && 'bg-purple-100 border-purple-500 text-purple-700',
        status === 'answered-marked'  && 'bg-purple-600 border-purple-600 text-white',
        status === 'current'          && 'border-brand-500 text-brand-700 ring-2 ring-brand-200',
        status === 'unanswered'       && 'border-gray-200 text-gray-500 hover:border-brand-300 bg-white',
      )}
    >{n}</button>
  )
}

// ─── Main Exam Interface ───────────────────────────────────────────────────
export default function ExamPage() {
  const { examId } = useParams<{ examId: string }>()
  const navigate = useNavigate()

  const [attemptData, setAttemptData] = useState<AttemptStartResponse | null>(null)
  const [questions, setQuestions] = useState<QuestionForStudent[]>([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [answers, setAnswers] = useState<Record<string, SavedAnswer>>({})
  const [marked, setMarked] = useState<Set<string>>(new Set())
  const [showSubmitModal, setShowSubmitModal] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const [loading, setLoading] = useState(true)
  const [tabSwitches, setTabSwitches] = useState(0)
  const autoSaveRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const startedRef = useRef(false)

  // ── Start / resume attempt ────────────────────────────────────────────
  useEffect(() => {
    if (!examId) return
    // React.StrictMode intentionally double-invokes effects in dev, which
    // was firing this exam-start request twice (each failure/success then
    // showing its own toast). Guard so we only ever send it once per mount.
    if (startedRef.current) return
    startedRef.current = true
    examsApi.start(examId).then(data => {
      setAttemptData(data)
      // Flatten all questions across sections
      const allQ = data.sections.flatMap(s => s.questions)
      setQuestions(allQ)
      setLoading(false)

      // Load saved answers
      attemptsApi.getAnswers(data.attempt_id).then(saved => {
        const map: Record<string, SavedAnswer> = {}
        saved.forEach(a => { map[a.question_id] = a })
        setAnswers(map)
        const mrk = new Set<string>()
        saved.filter(a => a.is_marked_for_review).forEach(a => mrk.add(a.question_id))
        setMarked(mrk)
      }).catch(() => {})
    }).catch(() => {
      // The axios response interceptor already surfaces the backend's
      // actual error message (e.g. "Exam already submitted") as a toast.
      // Showing a second, generic toast here just duplicates/confuses it.
      navigate('/exams')
    })
  }, [examId])

  // ── Proctoring: tab visibility ─────────────────────────────────────────
  useEffect(() => {
    if (!attemptData) return
    const handler = () => {
      if (document.hidden && attemptData) {
        const newCount = tabSwitches + 1
        setTabSwitches(newCount)
        attemptsApi.logProctoring(attemptData.attempt_id, 'tab_switch', 'Student switched tab')
        toast.error(`⚠ Tab switch detected! (${newCount}/${attemptData.max_tab_switches_allowed ?? 3})`, { duration: 4000 })
      }
    }
    document.addEventListener('visibilitychange', handler)
    return () => document.removeEventListener('visibilitychange', handler)
  }, [attemptData, tabSwitches])

  // ── Proctoring: copy/paste ─────────────────────────────────────────────
  useEffect(() => {
    if (!attemptData?.copy_paste_disabled) return
    const block = (e: ClipboardEvent) => {
      e.preventDefault()
      attemptsApi.logProctoring(attemptData.attempt_id, 'copy_attempt', 'Copy/paste attempted')
      toast.error('Copy/paste is disabled during this exam')
    }
    document.addEventListener('copy', block)
    document.addEventListener('paste', block)
    return () => { document.removeEventListener('copy', block); document.removeEventListener('paste', block) }
  }, [attemptData])

  // ── Auto-save every 30s ────────────────────────────────────────────────
  useEffect(() => {
    if (!attemptData) return
    autoSaveRef.current = setInterval(() => {
      const pending = Object.values(answers)
      if (pending.length > 0) {
        attemptsApi.bulkSaveAnswers(attemptData.attempt_id, pending).catch(() => {})
      }
    }, 30_000)
    return () => { if (autoSaveRef.current) clearInterval(autoSaveRef.current) }
  }, [attemptData, answers])

  // ── Handlers ─────────────────────────────────────────────────────────
  function selectOption(questionId: string, optionId: string) {
    const updated: SavedAnswer = {
      question_id: questionId,
      selected_option_id: optionId,
      is_marked_for_review: marked.has(questionId),
    }
    setAnswers(prev => ({ ...prev, [questionId]: updated }))
    // Save immediately
    if (attemptData) {
      attemptsApi.saveAnswer(attemptData.attempt_id, updated).catch(() => {})
    }
  }

  function toggleMultiSelectOption(questionId: string, optionId: string) {
    setAnswers(prev => {
      const existingIds = prev[questionId]?.selected_option_ids || []
      const nextIds = existingIds.includes(optionId)
        ? existingIds.filter(id => id !== optionId)
        : [...existingIds, optionId]
      const updated: SavedAnswer = {
        question_id: questionId,
        selected_option_ids: nextIds,
        is_marked_for_review: marked.has(questionId),
      }
      if (attemptData) {
        attemptsApi.saveAnswer(attemptData.attempt_id, updated).catch(() => {})
      }
      return { ...prev, [questionId]: updated }
    })
  }

  function clearAnswer(questionId: string) {
    setAnswers(prev => {
      const next = { ...prev }
      delete next[questionId]
      return next
    })
  }

  function toggleMark(questionId: string) {
    setMarked(prev => {
      const next = new Set(prev)
      next.has(questionId) ? next.delete(questionId) : next.add(questionId)
      // Sync
      if (attemptData) {
        const ans = answers[questionId] || { question_id: questionId, is_marked_for_review: false }
        attemptsApi.saveAnswer(attemptData.attempt_id, { ...ans, is_marked_for_review: !prev.has(questionId) }).catch(() => {})
      }
      return next
    })
  }

  async function handleSubmit() {
    if (!attemptData) return
    try {
      // Final save
      await attemptsApi.bulkSaveAnswers(attemptData.attempt_id, Object.values(answers))
      const res = await attemptsApi.submit(attemptData.attempt_id)
      setResult(res)
      setShowSubmitModal(false)
    } catch {
      toast.error('Submission failed. Please try again.')
    }
  }

  function handleTimeExpired() {
    toast.error('Time is up! Submitting your exam…', { duration: 5000 })
    handleSubmit()
  }

  // ── Loading ────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="fixed inset-0 bg-gray-50 flex items-center justify-center z-50">
        <div className="text-center">
          <Spinner size="lg" />
          <p className="mt-3 text-sm text-gray-600">Loading exam…</p>
        </div>
      </div>
    )
  }

  // ── Result screen ──────────────────────────────────────────────────────
  if (result) {
    return <ResultScreen result={result} onDone={() => navigate('/results')} />
  }

  if (!attemptData || questions.length === 0) return null

  const q = questions[currentIdx]
  const currentAnswer = answers[q.id]
  const answeredCount = Object.keys(answers).length
  const isMarked = marked.has(q.id)

  function getQStatus(idx: number): QStatus {
    const qid = questions[idx].id
    const isAns = !!answers[qid]
    const isMrk = marked.has(qid)
    if (isAns && isMrk) return 'answered-marked'
    if (isAns) return 'answered'
    if (isMrk) return 'marked'
    if (idx === currentIdx) return 'current'
    return 'unanswered'
  }

  return (
    <div className="exam-fullscreen flex flex-col">
      {/* Top bar */}
      <ExamTopBar
        title={attemptData.exam_title}
        endsAt={attemptData.ends_at}
        onExpire={handleTimeExpired}
        negativeMark={attemptData.negative_marking}
        totalMarks={attemptData.total_marks}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Question nav sidebar */}
        <aside className="w-64 bg-white border-r border-gray-200 flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <div className="text-xs font-semibold text-gray-500 mb-2">QUESTION NAVIGATOR</div>
            {/* Legend */}
            <div className="grid grid-cols-2 gap-1 text-[10px] text-gray-500">
              {[
                { cls: 'bg-brand-600', label: 'Answered' },
                { cls: 'bg-purple-600', label: 'Marked+Ans' },
                { cls: 'bg-purple-100 border border-purple-400', label: 'Marked' },
                { cls: 'bg-white border border-gray-200', label: 'Not visited' },
              ].map(({ cls, label }) => (
                <div key={label} className="flex items-center gap-1">
                  <div className={clsx('w-3 h-3 rounded flex-shrink-0', cls)} />
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            <div className="grid grid-cols-5 gap-1.5">
              {questions.map((_, i) => (
                <QNavBtn key={i} n={i + 1} status={i === currentIdx ? 'current' : getQStatus(i)} onClick={() => setCurrentIdx(i)} />
              ))}
            </div>
          </div>

          <div className="p-3 border-t border-gray-100 space-y-1.5 text-xs text-gray-500">
            <div className="flex justify-between"><span>Answered:</span><strong className="text-gray-800">{answeredCount}/{questions.length}</strong></div>
            <div className="flex justify-between"><span>Marked:</span><strong className="text-purple-700">{marked.size}</strong></div>
            <div className="flex justify-between"><span>Remaining:</span><strong className="text-gray-800">{questions.length - answeredCount}</strong></div>
          </div>
        </aside>

        {/* Question area */}
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-3xl mx-auto">
            {/* Section label */}
            {attemptData.sections.map(s =>
              s.questions.some(sq => sq.id === q.id) && (
                <div key={s.id} className="text-xs font-medium text-brand-600 mb-2 uppercase tracking-wide">{s.name}</div>
              )
            )}

            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                Question {currentIdx + 1} of {questions.length} · {q.marks} mark{q.marks !== 1 ? 's' : ''}
              </div>

              <p className="text-base text-gray-800 leading-relaxed mb-6">{q.text}</p>

              {q.image_url && (
                <img src={q.image_url} alt="Question" className="max-h-48 rounded-lg mb-5 border border-gray-100" />
              )}

              {/* Options */}
              {(q.question_type === 'mcq' || q.question_type === 'true_false') && (
                <div className="space-y-2.5">
                  {q.options.sort((a, b) => a.order_index - b.order_index).map((opt, i) => {
                    const selected = currentAnswer?.selected_option_id === opt.id
                    return (
                      <button
                        key={opt.id}
                        onClick={() => selectOption(q.id, opt.id)}
                        className={clsx(
                          'w-full flex items-start gap-3 px-4 py-3 rounded-lg border-2 text-left transition-all',
                          selected
                            ? 'border-brand-500 bg-blue-50 text-brand-800'
                            : 'border-gray-200 hover:border-brand-300 hover:bg-gray-50'
                        )}
                      >
                        <div className={clsx(
                          'w-5 h-5 rounded-full border-2 flex-shrink-0 mt-0.5 flex items-center justify-center transition-all',
                          selected ? 'border-brand-500 bg-brand-500' : 'border-gray-300'
                        )}>
                          {selected && <div className="w-2 h-2 rounded-full bg-white" />}
                        </div>
                        <span className="text-sm">
                          <span className="font-medium text-gray-500 mr-1.5">{String.fromCharCode(65 + i)}.</span>
                          {opt.text}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}

              {q.question_type === 'multi_select' && (
                <div className="space-y-2.5">
                  {q.options.sort((a, b) => a.order_index - b.order_index).map((opt, i) => {
                    const selectedIds = currentAnswer?.selected_option_ids || []
                    const selected = selectedIds.includes(opt.id)
                    return (
                      <button
                        key={opt.id}
                        onClick={() => toggleMultiSelectOption(q.id, opt.id)}
                        className={clsx(
                          'w-full flex items-start gap-3 px-4 py-3 rounded-lg border-2 text-left transition-all',
                          selected
                            ? 'border-brand-500 bg-blue-50 text-brand-800'
                            : 'border-gray-200 hover:border-brand-300 hover:bg-gray-50'
                        )}
                      >
                        <div className={clsx(
                          'w-5 h-5 rounded border-2 flex-shrink-0 mt-0.5 flex items-center justify-center transition-all',
                          selected ? 'border-brand-500 bg-brand-500' : 'border-gray-300'
                        )}>
                          {selected && <span className="text-white text-xs leading-none">✓</span>}
                        </div>
                        <span className="text-sm">
                          <span className="font-medium text-gray-500 mr-1.5">{String.fromCharCode(65 + i)}.</span>
                          {opt.text}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}

              {q.question_type === 'fill_blank' && (
                <input
                  type="text"
                  className="input max-w-sm"
                  placeholder="Type your answer here…"
                  value={currentAnswer?.text_answer || ''}
                  onChange={e => {
                    const updated: SavedAnswer = { question_id: q.id, text_answer: e.target.value, is_marked_for_review: isMarked }
                    setAnswers(prev => ({ ...prev, [q.id]: updated }))
                  }}
                />
              )}

              {(q.question_type === 'subjective' || q.question_type === 'descriptive') && (
                <textarea
                  className="input min-h-[160px]"
                  placeholder="Write your answer here…"
                  value={currentAnswer?.text_answer || ''}
                  onChange={e => {
                    const updated: SavedAnswer = { question_id: q.id, text_answer: e.target.value, is_marked_for_review: isMarked }
                    setAnswers(prev => ({ ...prev, [q.id]: updated }))
                  }}
                />
              )}

              {/* Q actions */}
              <div className="flex gap-2 mt-4 flex-wrap">
                <button
                  onClick={() => clearAnswer(q.id)}
                  className="text-xs text-gray-500 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50"
                >
                  Clear Response
                </button>
                <button
                  onClick={() => toggleMark(q.id)}
                  className={clsx(
                    'text-xs rounded-lg px-3 py-1.5 border transition-colors',
                    isMarked
                      ? 'bg-purple-100 border-purple-300 text-purple-700'
                      : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                  )}
                >
                  {isMarked ? '🚩 Marked for Review' : '🏳 Mark for Review'}
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Footer nav */}
      <footer className="bg-white border-t border-gray-200 px-6 py-3 flex items-center justify-between">
        <Button variant="secondary" size="sm" onClick={() => setCurrentIdx(i => Math.max(0, i - 1))} disabled={currentIdx === 0}>
          ← Previous
        </Button>

        <div className="text-center">
          <div className="text-xs text-gray-500">{answeredCount} / {questions.length} answered</div>
          <div className="w-40 mt-1">
            <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full bg-brand-600 rounded-full transition-all" style={{ width: `${answeredCount / questions.length * 100}%` }} />
            </div>
          </div>
        </div>

        {currentIdx < questions.length - 1
          ? <Button variant="primary" size="sm" onClick={() => setCurrentIdx(i => i + 1)}>Next →</Button>
          : <Button variant="success" size="sm" onClick={() => setShowSubmitModal(true)}>Submit Exam</Button>
        }
      </footer>

      {/* Submit confirmation modal */}
      <Modal
        open={showSubmitModal}
        onClose={() => setShowSubmitModal(false)}
        title="Submit Exam?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowSubmitModal(false)}>Review Answers</Button>
            <Button variant="success" onClick={handleSubmit}>Submit Now</Button>
          </>
        }
      >
        <p className="text-sm text-gray-600 mb-4">You're about to submit your exam. This action cannot be undone.</p>
        <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
          {[
            ['Total Questions', questions.length],
            ['Answered', answeredCount],
            ['Unanswered', questions.length - answeredCount],
            ['Marked for Review', marked.size],
          ].map(([label, val]) => (
            <div key={label as string} className="flex justify-between">
              <span className="text-gray-500">{label}</span>
              <strong className={val === 0 || label === 'Answered' ? 'text-gray-800' : 'text-amber-600'}>{val}</strong>
            </div>
          ))}
        </div>
        {questions.length - answeredCount > 0 && (
          <div className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
            ⚠ You have {questions.length - answeredCount} unanswered question{questions.length - answeredCount > 1 ? 's' : ''}.
          </div>
        )}
      </Modal>
    </div>
  )
}

// ─── Exam topbar with countdown ─────────────────────────────────────────────
function ExamTopBar({ title, endsAt, onExpire, negativeMark, totalMarks }: {
  title: string; endsAt: string; onExpire: () => void; negativeMark: boolean; totalMarks: number
}) {
  const { display, secondsLeft } = useCountdown(endsAt, onExpire)
  const isWarning = secondsLeft < 300

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between flex-shrink-0">
      <div className="flex items-center gap-3">
        <div className="w-7 h-7 bg-brand-600 rounded-lg flex items-center justify-center text-white font-bold text-xs">ED</div>
        <div>
          <div className="text-sm font-semibold text-gray-900 max-w-sm truncate">{title}</div>
          <div className="text-xs text-gray-400">
            {totalMarks} marks {negativeMark && '· Negative marking'}
          </div>
        </div>
      </div>

      <div className={clsx(
        'flex items-center gap-2 px-4 py-2 rounded-lg border',
        isWarning ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200'
      )}>
        <div>
          <div className={clsx('text-xs font-medium', isWarning ? 'text-red-500' : 'text-brand-600')}>Time Remaining</div>
          <div className={clsx('text-2xl font-bold tabular-nums tracking-wider', isWarning ? 'text-red-600' : 'text-brand-700')}>
            {display}
          </div>
        </div>
      </div>
    </header>
  )
}

// ─── Result screen after submission ─────────────────────────────────────────
function ResultScreen({ result, onDone }: { result: Result; onDone: () => void }) {
  const pct = Math.round(result.percentage)
  return (
    <div className="fixed inset-0 bg-gray-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xl p-8 max-w-md w-full text-center">
        <div className="text-5xl mb-4">{result.is_passed ? '🎉' : '😓'}</div>
        <h2 className="text-xl font-bold text-gray-900 mb-1">
          {result.is_passed ? 'Congratulations!' : 'Better luck next time'}
        </h2>
        <p className="text-sm text-gray-500 mb-6">Your exam has been submitted and graded.</p>

        <div className="flex justify-center mb-6">
          <ScoreRing pct={pct} size={120} />
        </div>

        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-blue-50 rounded-xl p-3">
            <div className="text-2xl font-bold text-brand-700">{result.obtained_marks}</div>
            <div className="text-xs text-gray-500">/ {result.total_marks} marks</div>
          </div>
          <div className={clsx('rounded-xl p-3', result.is_passed ? 'bg-green-50' : 'bg-red-50')}>
            <div className={clsx('text-2xl font-bold', result.is_passed ? 'text-green-700' : 'text-red-700')}>
              {result.is_passed ? 'PASS' : 'FAIL'}
            </div>
            <div className="text-xs text-gray-500">Status</div>
          </div>
          <div className="bg-purple-50 rounded-xl p-3">
            <div className="text-2xl font-bold text-purple-700">
              {result.rank ? `#${result.rank}` : '—'}
            </div>
            <div className="text-xs text-gray-500">Rank</div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 text-xs text-gray-600 mb-6">
          <div className="bg-green-50 rounded-lg p-2">✓ Correct<br /><strong className="text-green-700">{result.correct_answers}</strong></div>
          <div className="bg-red-50 rounded-lg p-2">✗ Wrong<br /><strong className="text-red-700">{result.wrong_answers}</strong></div>
          <div className="bg-gray-100 rounded-lg p-2">— Skipped<br /><strong>{result.unattempted}</strong></div>
        </div>

        <div className="flex gap-3 justify-center">
          <Button variant="secondary" onClick={onDone}>Back to Dashboard</Button>
          <Button variant="primary" onClick={onDone}>View Full Analysis</Button>
        </div>
      </div>
    </div>
  )
}
