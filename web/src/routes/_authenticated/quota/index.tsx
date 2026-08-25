/*
Copyright (C) 2023-2026 QuantumNous
*/
import { createFileRoute, redirect } from '@tanstack/react-router'

// Organization Quota page is retired (limit + allocatable model).
// Keep route so old bookmarks land on Workspaces.
export const Route = createFileRoute('/_authenticated/quota/')({
  beforeLoad: () => {
    throw redirect({ to: '/workspaces' })
  },
})
