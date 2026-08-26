/*
Copyright (C) 2023-2026 QuantumNous
*/
import { createFileRoute } from '@tanstack/react-router'
import z from 'zod'

import { WorkspacesPage } from '@/features/customer-org/workspaces-page'

const workspacesSearchSchema = z.object({
  page: z.number().optional().catch(1),
  pageSize: z.number().optional().catch(undefined),
  filter: z.string().optional().catch(''),
  status: z.array(z.string()).optional().catch([]),
})

export const Route = createFileRoute('/_authenticated/workspaces/')({
  // Personal users (no org yet) may open this page to create an organization.
  validateSearch: workspacesSearchSchema,
  component: WorkspacesPage,
})
