import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { authApi } from '@/lib/api'
import { Button, Input } from '@/components/ui'

const schema = z.object({
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  path: ['confirmPassword'],
  message: 'Passwords do not match',
})
type FormData = z.infer<typeof schema>

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''
  const [loading, setLoading] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  async function onSubmit(data: FormData) {
    if (!token) {
      toast.error('Reset link is invalid or missing a token.')
      return
    }
    setLoading(true)
    try {
      await authApi.resetPassword({
        token,
        new_password: data.password,
        confirm_password: data.confirmPassword,
      })
      toast.success('Password reset successfully! Please sign in.')
      navigate('/login')
    } catch (err: any) {
      toast.error(
        err?.response?.data?.detail ||
        'Reset link is invalid or has expired.'
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
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Reset your password</h2>
          <p className="text-sm text-gray-500 mb-6">
            Enter a new password for your account.
          </p>

          {!token && (
            <p className="text-sm text-red-600 mb-4">
              This reset link is missing or invalid. Please request a new one.
            </p>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input
              label="New Password"
              type="password"
              placeholder="Enter new password"
              error={errors.password?.message}
              {...register('password')}
            />
            <Input
              label="Confirm New Password"
              type="password"
              placeholder="Confirm new password"
              error={errors.confirmPassword?.message}
              {...register('confirmPassword')}
            />

            <Button type="submit" variant="primary" size="lg" loading={loading} className="w-full">
              Reset Password
            </Button>
          </form>

          <p className="text-xs text-center text-gray-400 mt-5">
            Remembered your password?{' '}
            <Link to="/login" className="text-brand-600 hover:underline font-medium">
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
