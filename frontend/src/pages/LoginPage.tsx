import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { authApi } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import { Button, Input } from '@/components/ui'

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})
type FormData = z.infer<typeof schema>

const DEMOS = [
  { role: 'student', email: 'rahul@examdesk.edu', password: 'student123', label: 'Student', icon: '🎓' },
  { role: 'instructor', email: 'arjun@examdesk.edu', password: 'instructor123', label: 'Instructor', icon: '👨‍🏫' },
  { role: 'admin', email: 'admin@examdesk.edu', password: 'admin123', label: 'Admin', icon: '🛡️' },
]

export default function LoginPage() {
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()
  const [loading, setLoading] = useState(false)

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  async function onSubmit(data: FormData) {
    setLoading(true)
    try {
      const res = await authApi.login(data.email, data.password)
      setAuth(res.user, res.access_token, res.refresh_token)
      toast.success(`Welcome back, ${res.user.full_name.split(' ')[0]}!`)
      navigate('/dashboard')
    } catch {
      toast.error('Invalid email or password')
    } finally {
      setLoading(false)
    }
  }

  function demoLogin(demo: (typeof DEMOS)[0]) {
    setValue('email', demo.email)
    setValue('password', demo.password)
    handleSubmit(onSubmit)()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-green-50 p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-brand-600 rounded-xl text-white font-bold text-xl mb-3">
            ED
          </div>
          <h1 className="text-2xl font-bold text-gray-900">ExamDesk</h1>
          <p className="text-sm text-gray-500 mt-1">Online Examination Platform</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-card p-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Sign in to your account</h2>
          <p className="text-sm text-gray-500 mb-6">Enter your credentials to continue</p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input
              label="Email Address"
              type="email"
              placeholder="you@examdesk.edu"
              error={errors.email?.message}
              {...register('email')}
            />
            <Input
              label="Password"
              type="password"
              placeholder="Enter your password"
              error={errors.password?.message}
              {...register('password')}
            />

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="rounded border-gray-300 w-3.5 h-3.5" />
                <span className="text-gray-600">Remember me</span>
              </label>
              <Link to="/forgot-password" className="text-brand-600 hover:text-brand-700 font-medium">
                Forgot password?
              </Link>
            </div>

            <Button type="submit" variant="primary" size="lg" loading={loading} className="w-full">
              Sign In
            </Button>
          </form>

          {/* Demo logins */}
          <div className="mt-6 pt-5 border-t border-gray-100">
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-3">Quick Demo Access</p>
            <div className="grid grid-cols-3 gap-2">
              {DEMOS.map(d => (
                <button
                  key={d.role}
                  onClick={() => demoLogin(d)}
                  className="flex flex-col items-center gap-1.5 p-3 border border-gray-200 rounded-xl hover:border-brand-300 hover:bg-blue-50 transition-all"
                >
                  <span className="text-xl">{d.icon}</span>
                  <span className="text-xs font-medium text-gray-700">{d.label}</span>
                </button>
              ))}
            </div>
          </div>

          <p className="text-xs text-center text-gray-400 mt-5">
            Need an account?{' '}
            <Link to="/register" className="text-brand-600 hover:underline font-medium">Register here</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
