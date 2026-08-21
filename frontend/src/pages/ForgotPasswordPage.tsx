import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { authApi } from '@/lib/api'
import { Button, Input } from '@/components/ui'

const schema = z.object({
  email: z.string().email('Enter a valid email'),
})
type FormData = z.infer<typeof schema>

export default function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  async function onSubmit(data: FormData) {
    setLoading(true)
    try {
      await authApi.forgotPassword(data.email)
      setSent(true)
      toast.success('If that email exists, a reset link has been sent.')
    } catch (err: any) {
      toast.error(
        err?.response?.data?.detail ||
        'Something went wrong. Please try again.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-green-50 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-brand-600 rounded-xl text-white font-bold text-xl mb-3">
            ED
          </div>
          <h1 className="text-2xl font-bold text-gray-900">ExamDesk</h1>
          <p className="text-sm text-gray-500 mt-1">Online Examination Platform</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-card p-8">
          {sent ? (
            <div className="text-center">
              <div className="text-4xl mb-3">📧</div>
              <h2 className="text-lg font-semibold text-gray-900 mb-1">Check your email</h2>
              <p className="text-sm text-gray-500 mb-6">
                If an account exists for that email, we've sent a link to reset your password.
              </p>
              <Link
                to="/login"
                className="text-brand-600 hover:text-brand-700 font-medium text-sm"
              >
                Back to Sign In
              </Link>
            </div>
          ) : (
            <>
              <h2 className="text-lg font-semibold text-gray-900 mb-1">Forgot your password?</h2>
              <p className="text-sm text-gray-500 mb-6">
                Enter your email and we'll send you a link to reset it.
              </p>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <Input
                  label="Email Address"
                  type="email"
                  placeholder="you@examdesk.edu"
                  error={errors.email?.message}
                  {...register('email')}
                />

                <Button type="submit" variant="primary" size="lg" loading={loading} className="w-full">
                  Send Reset Link
                </Button>
              </form>

              <p className="text-xs text-center text-gray-400 mt-5">
                Remembered your password?{' '}
                <Link to="/login" className="text-brand-600 hover:underline font-medium">
                  Sign In
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
