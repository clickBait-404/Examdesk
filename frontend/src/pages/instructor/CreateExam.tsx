import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { clsx } from 'clsx'
import { examsApi, subjectsApi } from '@/lib/api'
import { AppShell } from '@/components/layout/AppShell'
import { Card, Button, Input, Textarea, Select, Toggle } from '@/components/ui'

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

const STEPS = ['Basic Info', 'Settings', 'Proctoring', 'Review']

export default function CreateExamPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [step, setStep] = useState(0)
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

  const { data: subjects } = useQuery({ queryKey: ['subjects'], queryFn: subjectsApi.list })

  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { duration_minutes: 60, total_marks: 100, passing_marks: 40 },
  })

  const createMutation = useMutation({
    mutationFn: (data: FormData) => examsApi.create({
      ...data,
      ...settings,
      ...proctoring,
    }),
    onSuccess: (exam) => {
      toast.success('Exam created successfully!')
      qc.invalidateQueries({ queryKey: ['exams'] })
      navigate(`/exams`)
    },
    onError: () => toast.error('Failed to create exam'),
  })

  const publishMutation = useMutation({
    mutationFn: (id: string) => examsApi.publish(id),
    onSuccess: () => { toast.success('Exam published!'); navigate('/exams') },
  })

  async function onFinalSubmit(data: FormData, publish = false) {
    const exam = await createMutation.mutateAsync(data)
    if (publish) publishMutation.mutate(exam.id)
  }

  const watchData = watch()

  return (
    <AppShell title="Create Exam">
      {/* Step progress */}
      <div className="flex items-center gap-0 mb-8">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center flex-1">
            <div className="flex flex-col items-center cursor-pointer" onClick={() => step > i && setStep(i)}>
              <div className={clsx(
                'w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors',
                step > i ? 'bg-green-500 text-white' : step === i ? 'bg-brand-600 text-white' : 'bg-gray-200 text-gray-500'
              )}>
                {step > i ? '✓' : i + 1}
              </div>
              <span className={clsx('text-xs mt-1 font-medium', step === i ? 'text-brand-600' : 'text-gray-400')}>{s}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={clsx('flex-1 h-0.5 mx-2 mb-4 transition-colors', step > i ? 'bg-green-400' : 'bg-gray-200')} />
            )}
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit(d => onFinalSubmit(d, true))}>
        <Card className="max-w-3xl">
          {/* Step 0: Basic Info */}
          {step === 0 && (
            <div className="space-y-4">
              <h3 className="text-base font-semibold text-gray-800 mb-4">Basic Information</h3>
              <Input label="Exam Title *" placeholder="e.g. Computer Networks Midterm Examination" error={errors.title?.message} {...register('title')} />
              <Textarea label="Description" placeholder="Brief description of the exam…" {...register('description')} />
              <Textarea label="Instructions for Students" placeholder="Read all questions carefully. Each correct answer carries 2 marks…" {...register('instructions')} />
              <div className="grid grid-cols-2 gap-4">
                <Select
                  label="Subject"
                  placeholder="Select subject"
                  options={(subjects || []).map(s => ({ value: s.id, label: s.name }))}
                  {...register('subject_id')}
                />
                <Input label="Scheduled Start" type="datetime-local" {...register('scheduled_start')} />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <Input label="Duration (minutes) *" type="number" error={errors.duration_minutes?.message} {...register('duration_minutes', { valueAsNumber: true })} />
                <Input label="Total Marks *" type="number" error={errors.total_marks?.message} {...register('total_marks', { valueAsNumber: true })} />
                <Input label="Passing Marks *" type="number" error={errors.passing_marks?.message} {...register('passing_marks', { valueAsNumber: true })} />
              </div>
            </div>
          )}

          {/* Step 1: Settings */}
          {step === 1 && (
            <div>
              <h3 className="text-base font-semibold text-gray-800 mb-4">Exam Settings</h3>
              <div className="space-y-4">
                {[
                  { key: 'negative_marking', label: 'Negative Marking', desc: 'Deduct marks for wrong answers' },
                  { key: 'randomize_questions', label: 'Randomize Question Order', desc: 'Questions appear in random order per student' },
                  { key: 'randomize_options', label: 'Randomize Option Order', desc: 'MCQ options shuffled per student' },
                  { key: 'show_result_immediately', label: 'Show Result Immediately', desc: 'Students see result right after submission' },
                  { key: 'allow_review', label: 'Allow Answer Review', desc: 'Students can review answers before submitting' },
                ].map(({ key, label, desc }) => (
                  <div key={key} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                    <div>
                      <div className="text-sm font-medium text-gray-800">{label}</div>
                      <div className="text-xs text-gray-500">{desc}</div>
                    </div>
                    <Toggle
                      checked={settings[key as keyof typeof settings] as boolean}
                      onChange={v => setSettings(s => ({ ...s, [key]: v }))}
                    />
                  </div>
                ))}
                {settings.negative_marking && (
                  <Input
                    label="Marks deducted per wrong answer"
                    type="number"
                    value={settings.negative_marks_per_wrong}
                    onChange={e => setSettings(s => ({ ...s, negative_marks_per_wrong: +e.target.value }))}
                    hint="e.g. 0.25 deducts ¼ mark per wrong answer"
                  />
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Max Attempts</label>
                  <input type="number" min={1} max={5} value={settings.max_attempts}
                    onChange={e => setSettings(s => ({ ...s, max_attempts: +e.target.value }))}
                    className="input w-24" />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Proctoring */}
          {step === 2 && (
            <div>
              <h3 className="text-base font-semibold text-gray-800 mb-1">Proctoring & Security</h3>
              <p className="text-xs text-gray-500 mb-4">Configure anti-cheating measures for this exam.</p>
              <div className="space-y-4">
                {[
                  { key: 'full_screen_required', label: 'Require Full Screen', desc: 'Force fullscreen mode during exam' },
                  { key: 'tab_switch_detection', label: 'Tab Switch Detection', desc: 'Alert when student switches tabs or windows' },
                  { key: 'copy_paste_disabled', label: 'Disable Copy/Paste', desc: 'Block clipboard operations during exam' },
                ].map(({ key, label, desc }) => (
                  <div key={key} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                    <div>
                      <div className="text-sm font-medium text-gray-800">{label}</div>
                      <div className="text-xs text-gray-500">{desc}</div>
                    </div>
                    <Toggle
                      checked={proctoring[key as keyof typeof proctoring] as boolean}
                      onChange={v => setProctoring(p => ({ ...p, [key]: v }))}
                    />
                  </div>
                ))}
                {proctoring.tab_switch_detection && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Max allowed tab switches before disqualification</label>
                    <input type="number" min={1} max={10} value={proctoring.max_tab_switches_allowed}
                      onChange={e => setProctoring(p => ({ ...p, max_tab_switches_allowed: +e.target.value }))}
                      className="input w-24" />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 3: Review */}
          {step === 3 && (
            <div>
              <h3 className="text-base font-semibold text-gray-800 mb-4">Review & Publish</h3>
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-5">
                <p className="text-sm text-brand-700 font-medium">Review your exam before publishing. Once published, students can view it.</p>
              </div>
              <div className="grid grid-cols-2 gap-y-3 gap-x-8 text-sm">
                {[
                  ['Title', watchData.title || '—'],
                  ['Duration', `${watchData.duration_minutes} minutes`],
                  ['Total Marks', watchData.total_marks],
                  ['Passing Marks', watchData.passing_marks],
                  ['Negative Marking', settings.negative_marking ? 'Yes' : 'No'],
                  ['Randomize Questions', settings.randomize_questions ? 'Yes' : 'No'],
                  ['Full Screen Required', proctoring.full_screen_required ? 'Yes' : 'No'],
                  ['Tab Switch Detection', proctoring.tab_switch_detection ? 'Yes' : 'No'],
                  ['Max Tab Switches', proctoring.max_tab_switches_allowed],
                  ['Show Result Immediately', settings.show_result_immediately ? 'Yes' : 'No'],
                ].map(([k, v]) => (
                  <div key={k as string} className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-500">{k}</span>
                    <span className="font-medium text-gray-800">{v as string}</span>
                  </div>
                ))}
              </div>
              <div className="mt-5 p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700">
                ✅ All required fields are filled. You can save as draft or publish now.
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between mt-8 pt-5 border-t border-gray-100">
            <Button type="button" variant="secondary" onClick={() => step > 0 ? setStep(s => s - 1) : navigate('/exams')} disabled={step === 0}>
              {step === 0 ? 'Cancel' : '← Back'}
            </Button>
            <div className="flex gap-2">
              {step < STEPS.length - 1
                ? <Button type="button" variant="primary" onClick={() => setStep(s => s + 1)}>Next →</Button>
                : (
                  <>
                    <Button type="button" variant="secondary" loading={createMutation.isPending} onClick={handleSubmit(d => onFinalSubmit(d, false))}>
                      Save as Draft
                    </Button>
                    <Button type="submit" variant="primary" loading={createMutation.isPending || publishMutation.isPending}>
                      🚀 Publish Exam
                    </Button>
                  </>
                )
              }
            </div>
          </div>
        </Card>
      </form>
    </AppShell>
  )
}
