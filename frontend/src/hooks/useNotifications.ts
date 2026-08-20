import { useQuery } from '@tanstack/react-query'
import { notificationsApi } from '@/lib/api'

export function useUnreadCount() {
  const { data } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => notificationsApi.list({ unread_only: true, size: 1 }),
    refetchInterval: 30000,
  })
  return data?.total ?? 0
}
