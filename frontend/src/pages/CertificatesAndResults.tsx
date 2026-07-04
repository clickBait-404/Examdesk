import { useQuery } from '@tanstack/react-query'
import { useParams, Link } from 'react-router-dom'
import { format } from 'date-fns'
import { certificatesApi, resultsApi } from '@/lib/api'
import { AppShell } from '@/components/layout/AppShell'
import { Card, CardHeader, PageLoader, EmptyState, Button, ScoreRing, ProgressBar, Badge } from '@/components/ui'
import { useAuthStore } from '@/stores/auth'

// ══════════════════════════════════════════════════════════════════════════════
// CERTIFICATES PAGE
// ══════════════════════════════════════════════════════════════════════════════
export function CertificatesPage() {
  const { user } = useAuthStore()
  const { data, isLoading } = useQuery({
    queryKey: ['certificates', 'me'],
    queryFn: certificatesApi.mine,
  })

  return (
    <AppShell title="My Certificates">
      <div className="mb-5">
        <h2 className="text-lg font-bold text-gray-900">My Certificates</h2>
        <p className="text-sm text-gray-500">{data?.total || 0} certificates earned</p>
      </div>

      {isLoading ? <PageLoader /> : (
        <>
          {(!data?.items || data.items.length === 0) ? (
            <EmptyState
              icon="🎓"
              title="No certificates yet"
              description="Pass an exam to earn a certificate of completion."
            />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {data.items.map(cert => (
                <div key={cert.id} className="card p-6 border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-white">
                  {/* Certificate */}
                  <div className="text-center border border-amber-300 rounded-xl p-6">
                    <div className="text-xs font-bold tracking-[0.2em] text-amber-700 uppercase mb-4">
                      Certificate of Achievement
                    </div>
                    <div className="text-sm text-amber-800 mb-2">This is to certify that</div>
                    <div className="text-2xl font-bold text-gray-900 mb-1">{user?.full_name}</div>
                    <div className="text-sm text-gray-600 mb-3">has successfully completed</div>
                    <div className="text-base font-semibold text-brand-700 mb-4">
                      Examination Assessment
                    </div>
                    <div className="flex justify-around pt-4 border-t border-amber-200">
                      <div className="text-center">
                        <div className="text-xs text-amber-700 mb-1">Issued By</div>
                        <div className="text-sm font-semibold text-gray-800">ExamDesk Platform</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs text-amber-700 mb-1">Date</div>
                        <div className="text-sm font-semibold text-gray-800">
                          {format(new Date(cert.issued_at), 'MMM d, yyyy')}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs text-amber-700 mb-1">Status</div>
                        <span className="badge badge-green text-xs">✓ Verified</span>
                      </div>
                    </div>
                    <div className="mt-4 pt-3 border-t border-amber-100">
                      <div className="text-xs text-gray-400">Verification Code</div>
                      <div className="text-sm font-mono font-bold text-gray-700 mt-0.5 tracking-wide">
                        {cert.verification_code}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4 justify-center">
                    <Button variant="secondary" size="sm">📄 Download PDF</Button>
                    <a href={`/certificates/verify/${cert.verification_code}`} target="_blank" rel="noreferrer">
                      <Button variant="ghost" size="sm">🔗 Verify Online</Button>
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Verify form */}
      <Card className="mt-6 max-w-md">
        <CardHeader title="Verify a Certificate" subtitle="Enter a verification code to check authenticity" />
        <VerifyForm />
      </Card>
    </AppShell>
  )
}

function VerifyForm() {
  const [code, setCode] = useStateCompat('')
  const [result, setResult] = useStateCompat<{ is_valid: boolean; student_name?: string; exam_title?: string; percentage?: number; issued_at?: string } | null>(null)
  const [loading, setLoading] = useStateCompat(false)

  async function verify() {
    if (!code.trim()) return
    setLoading(true)
    try {
      const data = await certificatesApi.verify(code.trim())
      setResult(data)
    } catch {
      setResult({ is_valid: false })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          type="text"
          className="input flex-1 font-mono uppercase"
          placeholder="ED-XXXXXXXXXXXX"
          value={code}
          onChange={e => { setCode(e.target.value.toUpperCase()); setResult(null) }}
        />
        <Button variant="primary" size="sm" loading={loading} onClick={verify}>Verify</Button>
      </div>
      {result && (
        <div className={`rounded-xl p-4 border ${result.is_valid ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          {result.is_valid ? (
            <div className="text-sm text-green-800 space-y-1">
              <div className="font-semibold text-green-700 mb-2">✅ Certificate is Valid</div>
              {result.student_name && <div>Student: <strong>{result.student_name}</strong></div>}
              {result.exam_title && <div>Exam: <strong>{result.exam_title}</strong></div>}
              {result.percentage != null && <div>Score: <strong>{result.percentage}%</strong></div>}
              {result.issued_at && <div>Issued: <strong>{format(new Date(result.issued_at), 'MMM d, yyyy')}</strong></div>}
            </div>
          ) : (
            <div className="text-sm text-red-700 font-medium">❌ Invalid or revoked certificate</div>
          )}
        </div>
      )}
    </div>
  )
}

// helper to avoid importing useState in the same file cleanly
import { useState as useStateCompat } from 'react'

// ══════════════════════════════════════════════════════════════════════════════
// RESULT DETAIL PAGE
// ══════════════════════════════════════════════════════════════════════════════
export function ResultDetailPage() {
  const { resultId } = useParams<{ resultId: string }>()

  const { data: result, isLoading } = useQuery({
    queryKey: ['result', resultId],
    queryFn: () => resultsApi.get(resultId!),
    enabled: !!resultId,
  })

  if (isLoading) return <AppShell title="Result"><PageLoader /></AppShell>
  if (!result) return <AppShell title="Result"><EmptyState icon="❌" title="Result not found" /></AppShell>

  const pct = Math.round(result.percentage)

  return (
    <AppShell title="Exam Result">
      <div className="max-w-3xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link to="/results" className="text-sm text-brand-600 hover:underline">← My Results</Link>
        </div>

        {/* Score summary */}
        <Card className="mb-5">
          <div className="flex flex-col sm:flex-row items-center gap-6 p-2">
            <ScoreRing pct={pct} size={110} />
            <div className="flex-1 text-center sm:text-left">
              <h2 className="text-xl font-bold text-gray-900 mb-1">
                {result.exam?.title || 'Exam Result'}
              </h2>
              <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-semibold mb-3 ${
                result.is_passed ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-700'
              }`}>
                {result.is_passed ? '✓ PASSED' : '✗ FAILED'}
              </div>
              <div className="grid grid-cols-3 gap-3 mt-2">
                <div className="text-center bg-gray-50 rounded-xl p-3">
                  <div className="text-xl font-bold text-gray-900">{result.obtained_marks}</div>
                  <div className="text-xs text-gray-500">/ {result.total_marks} marks</div>
                </div>
                <div className="text-center bg-brand-50 rounded-xl p-3">
                  <div className="text-xl font-bold text-brand-700">{pct}%</div>
                  <div className="text-xs text-gray-500">Percentage</div>
                </div>
                <div className="text-center bg-purple-50 rounded-xl p-3">
                  <div className="text-xl font-bold text-purple-700">
                    {result.rank ? `#${result.rank}` : '—'}
                  </div>
                  <div className="text-xs text-gray-500">Rank</div>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Answer breakdown */}
        <div className="grid grid-cols-3 gap-4 mb-5">
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{result.correct_answers}</div>
            <div className="text-xs text-gray-500 mt-1">✓ Correct</div>
          </Card>
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-red-500">{result.wrong_answers}</div>
            <div className="text-xs text-gray-500 mt-1">✗ Wrong</div>
            {result.negative_marks > 0 && (
              <div className="text-xs text-red-400 mt-1">−{result.negative_marks} marks</div>
            )}
          </Card>
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-gray-500">{result.unattempted}</div>
            <div className="text-xs text-gray-500 mt-1">— Skipped</div>
          </Card>
        </div>

        {/* Section scores */}
        {Object.keys(result.section_scores).length > 0 && (
          <Card className="mb-5">
            <CardHeader title="Section-wise Scores" />
            <div className="space-y-3">
              {Object.entries(result.section_scores).map(([sectionId, score], i) => (
                <div key={sectionId}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">Section {i + 1}</span>
                    <span className="font-semibold">{score} marks</span>
                  </div>
                  <ProgressBar
                    value={score}
                    color={score >= 75 ? 'green' : score >= 50 ? 'blue' : 'amber'}
                  />
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Question-wise breakdown */}
        {result.question_wise && result.question_wise.length > 0 && (
          <Card>
            <CardHeader title="Question-wise Analysis" subtitle="Detailed breakdown of each answer" />
            <div className="space-y-2 mt-2">
              {result.question_wise.map((qw, i) => (
                <div key={qw.question_id} className={`flex items-start gap-3 p-3 rounded-xl border ${
                  qw.is_correct === true ? 'bg-green-50 border-green-200' :
                  qw.is_correct === false ? 'bg-red-50 border-red-200' :
                  'bg-gray-50 border-gray-200'
                }`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                    qw.is_correct === true ? 'bg-green-200 text-green-800' :
                    qw.is_correct === false ? 'bg-red-200 text-red-700' :
                    'bg-gray-200 text-gray-600'
                  }`}>
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-700 line-clamp-2">{qw.question_text}</p>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <div className={`text-xs font-semibold ${
                      qw.is_correct === true ? 'text-green-700' :
                      qw.is_correct === false ? 'text-red-600' : 'text-gray-500'
                    }`}>
                      {qw.is_correct === true ? '+' : qw.is_correct === false ? '' : '±'}{qw.marks_awarded ?? '—'}
                    </div>
                    <div className="text-[10px] text-gray-400 mt-0.5">
                      {qw.is_correct === true ? 'Correct' : qw.is_correct === false ? 'Wrong' : 'Pending'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Certificate link */}
        {result.is_passed && (
          <Card className="mt-5 bg-amber-50 border-amber-200">
            <div className="flex items-center gap-4">
              <span className="text-3xl">🎓</span>
              <div className="flex-1">
                <div className="font-semibold text-amber-900">Certificate Earned!</div>
                <div className="text-sm text-amber-700">You passed this exam. Your certificate has been issued.</div>
              </div>
              <Link to="/certificates">
                <Button variant="secondary" size="sm">View Certificate →</Button>
              </Link>
            </div>
          </Card>
        )}
      </div>
    </AppShell>
  )
}
