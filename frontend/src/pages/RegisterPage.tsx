import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { authApi } from '@/lib/api'
import { Button, Input } from '@/components/ui'

const schema = z.object({
  full_name: z.string().min(3, 'Name must be at least 3 characters'),
  email: z.string().email('Enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  path: ['confirmPassword'],
  message: 'Passwords do not match',
})

type FormData = z.infer<typeof schema>

export default function RegisterPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  async function onSubmit(data: FormData) {
    setLoading(true)

    try {
      await authApi.register({
        full_name: data.full_name,
        email: data.email,
        password: data.password,
        role: 'student',
      })

      toast.success('Account created successfully!')
      navigate('/login')
    } catch (err: any) {
      toast.error(
        err?.response?.data?.detail ||
        'Registration failed'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-green-50 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-card border border-gray-200 p-8">

        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-brand-600 rounded-xl text-white font-bold text-xl mb-3">
            ED
          </div>

          <h2 className="text-2xl font-bold">
            Create Account
          </h2>

          <p className="text-gray-500 mt-2">
            Register as a Student
          </p>
        </div>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-4"
        >
          <Input
            label="Full Name"
            {...register('full_name')}
            error={errors.full_name?.message}
          />

          <Input
            label="Email"
            type="email"
            {...register('email')}
            error={errors.email?.message}
          />

          <Input
            label="Password"
            type="password"
            {...register('password')}
            error={errors.password?.message}
          />

          <Input
            label="Confirm Password"
            type="password"
            {...register('confirmPassword')}
            error={errors.confirmPassword?.message}
          />

          <Button
            type="submit"
            loading={loading}
            className="w-full"
          >
            Register
          </Button>
        </form>

        <p className="text-center text-sm mt-6">
          Already have an account?{' '}
          <Link
            to="/login"
            className="text-brand-600 hover:underline"
          >
            Sign In
          </Link>
        </p>
      </div>
    </div>
  )
}