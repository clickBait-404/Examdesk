import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import Papa from 'papaparse'
import { clsx } from 'clsx'

import { examsApi, subjectsApi, questionsApi } from '@/lib/api'
import { AppShell } from '@/components/layout/AppShell'
import { Card, Button, Input, Textarea, Select, Toggle } from '@/components/ui'
import type { Question } from '@/types'

const schema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  description: z.string().optional(),
  instructions: z.string().optional(),
  duration_minutes: z.number().min(1).max(480),
  total_marks: z.number().min(1),
  passing_marks: z.number().min(1),
  scheduled_start: z.string().optional(),
  subject_id: z.string().optional(),
})

type FormData = z.infer<typeof schema>

const STEPS = [
  'Basic Info',
  'Questions',
  'Settings',
  'Proctoring',
  'Review',
]

export default function CreateExamPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [step, setStep] = useState(0)

  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([])
  const [uploadingQuestions, setUploadingQuestions] = useState(false)

  const [settings, setSettings] = useState({
    negative_marking: false,
    negative_marks_per_wrong: 0.25,
    randomize_questions: true,
    randomize_options: false,
    show_result_immediately: true,
    allow_review: true,
    max_attempts: 1,
  })

  const [proctoring, setProctoring] = useState({
    full_screen_required: true,
    tab_switch_detection: true,
    copy_paste_disabled: true,
    max_tab_switches_allowed: 3,
  })

  const { data: subjects } = useQuery({
    queryKey: ['subjects'],
    queryFn: subjectsApi.list,
  })

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      duration_minutes: 60,
      total_marks: 100,
      passing_marks: 40,
    },
  })

  const selectedSubjectId = watch('subject_id')

  const { data: questionData, isLoading: questionsLoading } = useQuery({
    queryKey: ['exam-questions', selectedSubjectId],
    queryFn: () =>
      questionsApi.list({
        page: 1,
        size: 100,
        subject_id: selectedSubjectId || undefined,
      }),
  })

  /*
   * Upload questions from CSV.
   *
   * Expected CSV columns:
   * text, question_type, difficulty, topic,
   * option_a, option_b, option_c, option_d,
   * correct, explanation
   */
  const handleQuestionUpload = (file: File) => {
    setUploadingQuestions(true)

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,

      complete: async (result) => {
        try {
          const rows = result.data as Record<string, string>[]

          const questions = rows
            .filter(row => row.text?.trim())
            .map(row => ({
              text: row.text.trim(),
              question_type: row.question_type?.trim() || 'mcq',
              difficulty: row.difficulty?.trim() || 'medium',
              topic: row.topic?.trim() || undefined,
              explanation: row.explanation?.trim() || undefined,
              tags: row.topic?.trim() ? [row.topic.trim()] : [],
              subject_id: selectedSubjectId || undefined,

              options: [
                {
                  text: row.option_a?.trim(),
                  is_correct:
                    row.correct?.trim().toUpperCase() === 'A',
                },
                {
                  text: row.option_b?.trim(),
                  is_correct:
                    row.correct?.trim().toUpperCase() === 'B',
                },
                {
                  text: row.option_c?.trim(),
                  is_correct:
                    row.correct?.trim().toUpperCase() === 'C',
                },
                {
                  text: row.option_d?.trim(),
                  is_correct:
                    row.correct?.trim().toUpperCase() === 'D',
                },
              ].filter(option => option.text),
            }))

          if (questions.length === 0) {
            toast.error('No valid questions found in CSV')
            return
          }

          const response = await questionsApi.bulkImport(questions) as {
            created: number
            ids: string[]
          }

          if (!response.ids || response.ids.length === 0) {
            toast.error(
              'Questions were uploaded, but their IDs were not returned by the server'
            )
            return
          }

          setSelectedQuestionIds(prev => [
            ...prev,
            ...response.ids,
          ])

          qc.invalidateQueries({
            queryKey: ['exam-questions'],
          })

          qc.invalidateQueries({
            queryKey: ['questions'],
          })

          toast.success(
            `${response.created} questions uploaded and selected`
          )
        } catch (error: any) {
          console.error('Question upload failed:', error)

          const message =
            error?.response?.data?.detail ||
            error?.message ||
            'Failed to upload questions'

          toast.error(message)
        } finally {
          setUploadingQuestions(false)
        }
      },

      error: () => {
        toast.error('Could not read CSV file')
        setUploadingQuestions(false)
      },
    })
  }

  /*
   * Create the exam and attach the selected questions.
   */
  const createMutation = useMutation({
    mutationFn: (data: FormData) => {
      const marksPerQuestion =
        selectedQuestionIds.length > 0
          ? data.total_marks / selectedQuestionIds.length
          : 1

      return examsApi.create({
        ...data,
        ...settings,
        ...proctoring,

        sections: [
          {
            name: 'General',
            description: 'Exam questions',
            order_index: 0,
            marks: data.total_marks,
            marks_per_question: marksPerQuestion,
            question_ids: selectedQuestionIds,
          },
        ],
      })
    },

    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: ['exams'],
      })
    },

    onError: () => {
      toast.error('Failed to create exam')
    },
  })

  /*
   * Publish an already-created draft exam.
   */
  const publishMutation = useMutation({
    mutationFn: (id: string) =>
      examsApi.publish(id),

    onError: (error: any) => {
      const message =
        error?.response?.data?.detail ||
        error?.message ||
        'Failed to publish exam'

      toast.error(message)
    },
  })

  /*
   * Save as draft OR create + publish.
   */
  async function onFinalSubmit(
    data: FormData,
    publish = false
  ) {
    try {
      if (
        publish &&
        selectedQuestionIds.length === 0
      ) {
        toast.error(
          'Select or upload at least one question before publishing'
        )
        setStep(1)
        return
      }

      const exam =
        await createMutation.mutateAsync(data)

      if (publish) {
        await publishMutation.mutateAsync(exam.id)

        toast.success('Exam published!')
      } else {
        toast.success('Exam saved as draft!')
      }

      qc.invalidateQueries({
        queryKey: ['exams'],
      })

      navigate('/exams')
    } catch (error: any) {
      console.error(
        'Exam submission failed:',
        error
      )

      const message =
        error?.response?.data?.detail ||
        error?.message ||
        'Failed to save/publish exam'

      toast.error(message)
    }
  }

  const watchData = watch()

  return (
    <AppShell title="Create Exam">

      {/* Step progress */}
      <div className="flex items-center gap-0 mb-8">
        {STEPS.map((s, i) => (
          <div
            key={s}
            className="flex items-center flex-1"
          >
            <div
              className="flex flex-col items-center cursor-pointer"
              onClick={() =>
                step > i && setStep(i)
              }
            >
              <div
                className={clsx(
                  'w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors',
                  step > i
                    ? 'bg-green-500 text-white'
                    : step === i
                      ? 'bg-brand-600 text-white'
                      : 'bg-gray-200 text-gray-500'
                )}
              >
                {step > i ? '✓' : i + 1}
              </div>

              <span
                className={clsx(
                  'text-xs mt-1 font-medium',
                  step === i
                    ? 'text-brand-600'
                    : 'text-gray-400'
                )}
              >
                {s}
              </span>
            </div>

            {i < STEPS.length - 1 && (
              <div
                className={clsx(
                  'flex-1 h-0.5 mx-2 mb-4 transition-colors',
                  step > i
                    ? 'bg-green-400'
                    : 'bg-gray-200'
                )}
              />
            )}
          </div>
        ))}
      </div>

      <form
        onSubmit={handleSubmit(data =>
          onFinalSubmit(data, true)
        )}
      >
        <Card className="max-w-3xl">

          {/* =========================================================
              STEP 0: BASIC INFO
          ========================================================= */}
          {step === 0 && (
            <div className="space-y-4">
              <h3 className="text-base font-semibold text-gray-800 mb-4">
                Basic Information
              </h3>

              <Input
                label="Exam Title *"
                placeholder="e.g. Computer Networks Midterm Examination"
                error={errors.title?.message}
                {...register('title')}
              />

              <Textarea
                label="Description"
                placeholder="Brief description of the exam…"
                {...register('description')}
              />

              <Textarea
                label="Instructions for Students"
                placeholder="Read all questions carefully. Each correct answer carries 2 marks…"
                {...register('instructions')}
              />

              <div className="grid grid-cols-2 gap-4">
                <Select
                  label="Subject"
                  placeholder="Select subject"
                  options={(subjects || []).map(
                    s => ({
                      value: s.id,
                      label: s.name,
                    })
                  )}
                  {...register('subject_id')}
                />

                <Input
                  label="Scheduled Start"
                  type="datetime-local"
                  {...register('scheduled_start')}
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <Input
                  label="Duration (minutes) *"
                  type="number"
                  error={errors.duration_minutes?.message}
                  {...register(
                    'duration_minutes',
                    { valueAsNumber: true }
                  )}
                />

                <Input
                  label="Total Marks *"
                  type="number"
                  error={errors.total_marks?.message}
                  {...register(
                    'total_marks',
                    { valueAsNumber: true }
                  )}
                />

                <Input
                  label="Passing Marks *"
                  type="number"
                  error={errors.passing_marks?.message}
                  {...register(
                    'passing_marks',
                    { valueAsNumber: true }
                  )}
                />
              </div>
            </div>
          )}

          {/* =========================================================
              STEP 1: QUESTIONS
          ========================================================= */}
          {step === 1 && (
            <div>

              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-semibold text-gray-800">
                    Select Questions
                  </h3>

                  <p className="text-xs text-gray-500">
                    Select questions from the Question Bank
                    or upload a CSV file.
                  </p>
                </div>

                <label
                  className={clsx(
                    'btn btn-secondary btn-sm cursor-pointer',
                    uploadingQuestions &&
                      'opacity-50 cursor-not-allowed'
                  )}
                >
                  📤 Upload CSV

                  <input
                    type="file"
                    accept=".csv"
                    className="hidden"
                    disabled={uploadingQuestions}
                    onChange={e => {
                      const file =
                        e.target.files?.[0]

                      if (file) {
                        handleQuestionUpload(file)
                      }

                      e.target.value = ''
                    }}
                  />
                </label>
              </div>

              {/* Selected count */}
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-xl">
                <p className="text-sm text-blue-700">
                  <strong>
                    {selectedQuestionIds.length}
                  </strong>{' '}
                  question(s) selected
                </p>

                <p className="text-xs text-blue-600 mt-1">
                  CSV columns: text, question_type,
                  difficulty, topic, option_a,
                  option_b, option_c, option_d,
                  correct, explanation
                </p>
              </div>

              {uploadingQuestions && (
                <div className="mb-4 text-sm text-gray-500">
                  Uploading questions...
                </div>
              )}

              {questionsLoading ? (
                <div className="py-8 text-center text-sm text-gray-500">
                  Loading questions...
                </div>
              ) : (
                <div className="space-y-2 max-h-[420px] overflow-y-auto">

                  {(questionData?.items || []).map(
                    (question: Question) => {
                      const selected =
                        selectedQuestionIds.includes(
                          question.id
                        )

                      return (
                        <label
                          key={question.id}
                          className={clsx(
                            'block p-3 border rounded-xl cursor-pointer transition-colors',
                            selected
                              ? 'border-brand-500 bg-brand-50'
                              : 'border-gray-200 hover:bg-gray-50'
                          )}
                        >
                          <div className="flex items-start gap-3">

                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={() => {
                                setSelectedQuestionIds(
                                  prev =>
                                    selected
                                      ? prev.filter(
                                          id =>
                                            id !==
                                            question.id
                                        )
                                      : [
                                          ...prev,
                                          question.id,
                                        ]
                                )
                              }}
                              className="mt-1"
                            />

                            <div className="flex-1">

                              <div className="flex gap-2 mb-1">
                                <span className="text-xs font-medium text-purple-600">
                                  {question.question_type
                                    .replace(
                                      '_',
                                      ' '
                                    )
                                    .toUpperCase()}
                                </span>

                                <span className="text-xs text-gray-500">
                                  {question.difficulty}
                                </span>

                                {question.topic && (
                                  <span className="text-xs text-gray-500">
                                    • {question.topic}
                                  </span>
                                )}
                              </div>

                              <p className="text-sm text-gray-800">
                                {question.text}
                              </p>

                              {question.options?.length > 0 && (
                                <div className="grid grid-cols-2 gap-1 mt-2">
                                  {question.options
                                    .slice()
                                    .sort(
                                      (a, b) =>
                                        a.order_index -
                                        b.order_index
                                    )
                                    .map(
                                      (option, index) => (
                                        <div
                                          key={option.id}
                                          className="text-xs text-gray-500"
                                        >
                                          {String.fromCharCode(
                                            65 + index
                                          )}
                                          . {option.text}
                                        </div>
                                      )
                                    )}
                                </div>
                              )}
                            </div>
                          </div>
                        </label>
                      )
                    }
                  )}

                  {!questionData?.items?.length && (
                    <div className="py-10 text-center text-sm text-gray-500">
                      No questions found.
                      <br />
                      Upload a CSV file to add questions.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* =========================================================
              STEP 2: SETTINGS
          ========================================================= */}
          {step === 2 && (
            <div>
              <h3 className="text-base font-semibold text-gray-800 mb-4">
                Exam Settings
              </h3>

              <div className="space-y-4">

                {[
                  {
                    key: 'negative_marking',
                    label: 'Negative Marking',
                    desc: 'Deduct marks for wrong answers',
                  },
                  {
                    key: 'randomize_questions',
                    label: 'Randomize Question Order',
                    desc: 'Questions appear in random order per student',
                  },
                  {
                    key: 'randomize_options',
                    label: 'Randomize Option Order',
                    desc: 'MCQ options shuffled per student',
                  },
                  {
                    key: 'show_result_immediately',
                    label: 'Show Result Immediately',
                    desc: 'Students see result right after submission',
                  },
                  {
                    key: 'allow_review',
                    label: 'Allow Answer Review',
                    desc: 'Students can review answers before submitting',
                  },
                ].map(
                  ({ key, label, desc }) => (
                    <div
                      key={key}
                      className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0"
                    >
                      <div>
                        <div className="text-sm font-medium text-gray-800">
                          {label}
                        </div>

                        <div className="text-xs text-gray-500">
                          {desc}
                        </div>
                      </div>

                      <Toggle
                        checked={
                          settings[
                            key as keyof typeof settings
                          ] as boolean
                        }
                        onChange={v =>
                          setSettings(s => ({
                            ...s,
                            [key]: v,
                          }))
                        }
                      />
                    </div>
                  )
                )}

                {settings.negative_marking && (
                  <Input
                    label="Marks deducted per wrong answer"
                    type="number"
                    value={
                      settings.negative_marks_per_wrong
                    }
                    onChange={e =>
                      setSettings(s => ({
                        ...s,
                        negative_marks_per_wrong:
                          +e.target.value,
                      }))
                    }
                    hint="e.g. 0.25 deducts ¼ mark per wrong answer"
                  />
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Max Attempts
                  </label>

                  <input
                    type="number"
                    min={1}
                    max={5}
                    value={settings.max_attempts}
                    onChange={e =>
                      setSettings(s => ({
                        ...s,
                        max_attempts:
                          +e.target.value,
                      }))
                    }
                    className="input w-24"
                  />
                </div>
              </div>
            </div>
          )}

          {/* =========================================================
              STEP 3: PROCTORING
          ========================================================= */}
          {step === 3 && (
            <div>
              <h3 className="text-base font-semibold text-gray-800 mb-1">
                Proctoring & Security
              </h3>

              <p className="text-xs text-gray-500 mb-4">
                Configure anti-cheating measures for this exam.
              </p>

              <div className="space-y-4">

                {[
                  {
                    key: 'full_screen_required',
                    label: 'Require Full Screen',
                    desc: 'Force fullscreen mode during exam',
                  },
                  {
                    key: 'tab_switch_detection',
                    label: 'Tab Switch Detection',
                    desc: 'Alert when student switches tabs or windows',
                  },
                  {
                    key: 'copy_paste_disabled',
                    label: 'Disable Copy/Paste',
                    desc: 'Block clipboard operations during exam',
                  },
                ].map(
                  ({ key, label, desc }) => (
                    <div
                      key={key}
                      className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0"
                    >
                      <div>
                        <div className="text-sm font-medium text-gray-800">
                          {label}
                        </div>

                        <div className="text-xs text-gray-500">
                          {desc}
                        </div>
                      </div>

                      <Toggle
                        checked={
                          proctoring[
                            key as keyof typeof proctoring
                          ] as boolean
                        }
                        onChange={v =>
                          setProctoring(p => ({
                            ...p,
                            [key]: v,
                          }))
                        }
                      />
                    </div>
                  )
                )}

                {proctoring.tab_switch_detection && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Max allowed tab switches before disqualification
                    </label>

                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={
                        proctoring.max_tab_switches_allowed
                      }
                      onChange={e =>
                        setProctoring(p => ({
                          ...p,
                          max_tab_switches_allowed:
                            +e.target.value,
                        }))
                      }
                      className="input w-24"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* =========================================================
              STEP 4: REVIEW
          ========================================================= */}
          {step === 4 && (
            <div>
              <h3 className="text-base font-semibold text-gray-800 mb-4">
                Review & Publish
              </h3>

              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-5">
                <p className="text-sm text-brand-700 font-medium">
                  Review your exam before publishing.
                  Once published, students can view it.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-y-3 gap-x-8 text-sm">
                {[
                  [
                    'Title',
                    watchData.title || '—',
                  ],
                  [
                    'Duration',
                    `${watchData.duration_minutes} minutes`,
                  ],
                  [
                    'Total Marks',
                    watchData.total_marks,
                  ],
                  [
                    'Passing Marks',
                    watchData.passing_marks,
                  ],
                  [
                    'Questions',
                    selectedQuestionIds.length,
                  ],
                  [
                    'Negative Marking',
                    settings.negative_marking
                      ? 'Yes'
                      : 'No',
                  ],
                  [
                    'Randomize Questions',
                    settings.randomize_questions
                      ? 'Yes'
                      : 'No',
                  ],
                  [
                    'Full Screen Required',
                    proctoring.full_screen_required
                      ? 'Yes'
                      : 'No',
                  ],
                  [
                    'Tab Switch Detection',
                    proctoring.tab_switch_detection
                      ? 'Yes'
                      : 'No',
                  ],
                  [
                    'Max Tab Switches',
                    proctoring.max_tab_switches_allowed,
                  ],
                  [
                    'Show Result Immediately',
                    settings.show_result_immediately
                      ? 'Yes'
                      : 'No',
                  ],
                ].map(([k, v]) => (
                  <div
                    key={k as string}
                    className="flex justify-between py-2 border-b border-gray-100"
                  >
                    <span className="text-gray-500">
                      {k}
                    </span>

                    <span className="font-medium text-gray-800">
                      {v as string}
                    </span>
                  </div>
                ))}
              </div>

              <div
                className={clsx(
                  'mt-5 p-3 rounded-xl text-sm',
                  selectedQuestionIds.length > 0
                    ? 'bg-green-50 border border-green-200 text-green-700'
                    : 'bg-red-50 border border-red-200 text-red-700'
                )}
              >
                {selectedQuestionIds.length > 0 ? (
                  <>
                    ✅ {selectedQuestionIds.length} question(s)
                    selected. You can save the exam as a draft
                    or publish it now.
                  </>
                ) : (
                  <>
                    ⚠️ No questions selected. Add at least one
                    question before publishing.
                  </>
                )}
              </div>
            </div>
          )}

          {/* =========================================================
              NAVIGATION
          ========================================================= */}
          <div className="flex items-center justify-between mt-8 pt-5 border-t border-gray-100">

            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                step > 0
                  ? setStep(s => s - 1)
                  : navigate('/exams')
              }
              disabled={step === 0}
            >
              {step === 0 ? 'Cancel' : '← Back'}
            </Button>

            <div className="flex gap-2">

              {step < STEPS.length - 1 ? (
                <Button
                  type="button"
                  variant="primary"
                  onClick={() =>
                    setStep(s => s + 1)
                  }
                >
                  Next →
                </Button>
              ) : (
                <>
                  <Button
                    type="button"
                    variant="secondary"
                    loading={createMutation.isPending}
                    onClick={handleSubmit(
                      data =>
                        onFinalSubmit(
                          data,
                          false
                        )
                    )}
                  >
                    Save as Draft
                  </Button>

                  <Button
                    type="submit"
                    variant="primary"
                    loading={
                      createMutation.isPending ||
                      publishMutation.isPending
                    }
                    disabled={
                      selectedQuestionIds.length === 0
                    }
                  >
                    🚀 Publish Exam
                  </Button>
                </>
              )}

            </div>
          </div>

        </Card>
      </form>
    </AppShell>
  )
}
