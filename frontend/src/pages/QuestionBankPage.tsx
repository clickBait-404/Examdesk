// ─── QuestionBank Page ─────────────────────────────────────────────────────
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { questionsApi, subjectsApi } from '@/lib/api'
import { AppShell } from '@/components/layout/AppShell'
import { Card, Button, Badge, StatusBadge, Modal, Input, Select, Textarea, SearchBar, PageLoader, EmptyState } from '@/components/ui'
import { useAuthStore } from '@/stores/auth'
import type { Question } from '@/types'

export function QuestionBankPage() {
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [filterDifficulty, setFilterDifficulty] = useState('')
  const [filterType, setFilterType] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [page, setPage] = useState(1)

  const { data: subjects } = useQuery({ queryKey: ['subjects'], queryFn: subjectsApi.list })
  const { data, isLoading } = useQuery({
    queryKey: ['questions', { page, search, filterDifficulty, filterType }],
    queryFn: () => questionsApi.list({ page, size: 15, search: search || undefined, difficulty: filterDifficulty || undefined, question_type: filterType || undefined }),
  })

  const deleteMutation = useMutation({
    mutationFn: questionsApi.delete,
    onSuccess: () => { toast.success('Question removed'); qc.invalidateQueries({ queryKey: ['questions'] }) },
  })

  const canEdit = user?.role === 'instructor' || user?.role === 'admin'

  return (
    <AppShell title="Question Bank">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Question Bank</h2>
          <p className="text-sm text-gray-500">{data?.total || 0} questions across all subjects</p>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <Button variant="secondary" size="sm">📤 Bulk Import</Button>
            <Button variant="primary" size="sm" onClick={() => setShowAdd(true)}>+ Add Question</Button>
          </div>
        )}
      </div>

      {/* Filters */}
      <Card className="mb-4 p-3">
        <div className="flex flex-wrap gap-3 items-center">
          <SearchBar value={search} onChange={setSearch} placeholder="Search questions…" />
          <select className="input w-auto text-sm py-1.5" value={filterType} onChange={e => setFilterType(e.target.value)}>
            <option value="">All Types</option>
            {['mcq', 'true_false', 'multi_select', 'fill_blank', 'subjective'].map(t =>
              <option key={t} value={t}>{t.replace('_', ' ').toUpperCase()}</option>
            )}
          </select>
          <select className="input w-auto text-sm py-1.5" value={filterDifficulty} onChange={e => setFilterDifficulty(e.target.value)}>
            <option value="">All Difficulties</option>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </div>
      </Card>

      {isLoading ? <PageLoader /> : (
        <>
          <div className="space-y-3">
            {(data?.items || []).map((q: Question) => (
              <Card key={q.id} className="p-4">
                <div className="flex items-start justify-between gap-4 mb-2">
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="purple">{q.question_type.replace('_', ' ').toUpperCase()}</Badge>
                    <StatusBadge status={q.difficulty} />
                    {q.topic && <Badge variant="gray">{q.topic}</Badge>}
                    {q.tags.slice(0, 3).map(t => <Badge key={t} variant="gray">{t}</Badge>)}
                  </div>
                  {canEdit && (
                    <div className="flex gap-1 flex-shrink-0">
                      <Button variant="ghost" size="sm">Edit</Button>
                      <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate(q.id)} className="text-red-500 hover:text-red-700">Remove</Button>
                    </div>
                  )}
                </div>
                <p className="text-sm text-gray-800 mb-3 leading-relaxed">{q.text}</p>
                {q.options.length > 0 && (
                  <div className="grid grid-cols-2 gap-1.5">
                    {q.options.sort((a, b) => a.order_index - b.order_index).map((opt, i) => (
                      <div key={opt.id} className={`text-xs px-3 py-1.5 rounded-lg border ${
                        opt.is_correct ? 'bg-green-50 border-green-200 text-green-700 font-medium' : 'bg-gray-50 border-gray-200 text-gray-600'
                      }`}>
                        {String.fromCharCode(65 + i)}. {opt.text} {opt.is_correct && '✓'}
                      </div>
                    ))}
                  </div>
                )}
                {q.explanation && (
                  <div className="mt-2 text-xs text-blue-700 bg-blue-50 rounded-lg px-3 py-1.5">
                    💡 {q.explanation}
                  </div>
                )}
              </Card>
            ))}
            {data?.items.length === 0 && (
              <EmptyState icon="🗄️" title="No questions found" description="Try adjusting your filters or add new questions." />
            )}
          </div>

          {/* Pagination */}
          {data && data.pages > 1 && (
            <div className="flex justify-center gap-1 mt-5">
              {Array.from({ length: data.pages }, (_, i) => i + 1).map(p => (
                <button key={p} onClick={() => setPage(p)}
                  className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${
                    page === p ? 'bg-brand-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}>{p}</button>
              ))}
            </div>
          )}
        </>
      )}

      <AddQuestionModal open={showAdd} onClose={() => setShowAdd(false)} subjects={subjects || []} />
    </AppShell>
  )
}

function AddQuestionModal({ open, onClose, subjects }: { open: boolean; onClose: () => void; subjects: { id: string; name: string }[] }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({ text: '', question_type: 'mcq', difficulty: 'medium', topic: '', subject_id: '', explanation: '' })
  const [options, setOptions] = useState([
    { text: '', is_correct: false }, { text: '', is_correct: false },
    { text: '', is_correct: true }, { text: '', is_correct: false },
  ])

  const mutation = useMutation({
    mutationFn: () => questionsApi.create({
      ...form,
      tags: form.topic ? [form.topic] : [],
      options: options.map((o, i) => ({ ...o, order_index: i })),
      subject_id: form.subject_id || undefined,
    } as any),
    onSuccess: () => { toast.success('Question added!'); qc.invalidateQueries({ queryKey: ['questions'] }); onClose() },
  })

  return (
    <Modal open={open} onClose={onClose} title="Add New Question"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button variant="primary" loading={mutation.isPending} onClick={() => mutation.mutate()}>Add Question</Button></>}
    >
      <div className="space-y-3">
        <Textarea label="Question Text *" value={form.text} onChange={e => setForm(f => ({ ...f, text: e.target.value }))} placeholder="Enter the question…" />
        <div className="grid grid-cols-3 gap-3">
          <Select label="Type" value={form.question_type} onChange={e => setForm(f => ({ ...f, question_type: e.target.value }))}
            options={[{value:'mcq',label:'MCQ'},{value:'true_false',label:'True/False'},{value:'subjective',label:'Subjective'},{value:'fill_blank',label:'Fill Blank'}]} />
          <Select label="Difficulty" value={form.difficulty} onChange={e => setForm(f => ({ ...f, difficulty: e.target.value }))}
            options={[{value:'easy',label:'Easy'},{value:'medium',label:'Medium'},{value:'hard',label:'Hard'}]} />
          <Select label="Subject" value={form.subject_id} onChange={e => setForm(f => ({ ...f, subject_id: e.target.value }))}
            placeholder="Select subject" options={subjects.map(s => ({ value: s.id, label: s.name }))} />
        </div>
        <Input label="Topic" value={form.topic} onChange={e => setForm(f => ({ ...f, topic: e.target.value }))} placeholder="e.g. TCP/IP, Normalization" />
        {form.question_type === 'mcq' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Options (select correct one)</label>
            {options.map((o, i) => (
              <div key={i} className="flex gap-2 mb-2">
                <input type="radio" name="correct" checked={o.is_correct} onChange={() => setOptions(opts => opts.map((opt, j) => ({ ...opt, is_correct: j === i })))} className="mt-2.5 w-auto flex-shrink-0" />
                <input type="text" value={o.text} onChange={e => setOptions(opts => opts.map((opt, j) => j === i ? { ...opt, text: e.target.value } : opt))}
                  placeholder={`Option ${String.fromCharCode(65 + i)}`} className="input" />
              </div>
            ))}
          </div>
        )}
        <Input label="Explanation (shown after exam)" value={form.explanation} onChange={e => setForm(f => ({ ...f, explanation: e.target.value }))} placeholder="Optional explanation for the correct answer" />
      </div>
    </Modal>
  )
}

export default QuestionBankPage
