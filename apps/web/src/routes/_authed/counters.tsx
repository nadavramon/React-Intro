import { createFileRoute } from '@tanstack/react-router'
import CounterApp from '@/features/counter'

export const Route = createFileRoute('/_authed/counters')({ component: CounterApp })
