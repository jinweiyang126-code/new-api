/*
Copyright (C) 2023-2026 QuantumNous
*/
import i18next from 'i18next'
import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'

import { getSelfOrgWalletLedger, type OrgWalletLedgerEntry } from '../api'

interface UseOrgWalletLedgerOptions {
  customerId?: number
  workspaceId?: number
  initialPage?: number
  initialPageSize?: number
  enabled?: boolean
}

export function useOrgWalletLedger(options: UseOrgWalletLedgerOptions = {}) {
  const {
    customerId = 0,
    workspaceId = 0,
    initialPage = 1,
    initialPageSize = 10,
    enabled = true,
  } = options

  const [records, setRecords] = useState<OrgWalletLedgerEntry[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(initialPage)
  const [pageSize, setPageSize] = useState(initialPageSize)
  const [loading, setLoading] = useState(false)

  const fetchLedger = useCallback(async () => {
    if (!enabled) return
    setLoading(true)
    try {
      const res = await getSelfOrgWalletLedger({
        customer_id: customerId > 0 ? customerId : undefined,
        workspace_id: workspaceId > 0 ? workspaceId : undefined,
        p: page,
        size: pageSize,
      })
      if (res.success && res.data) {
        setRecords(res.data.items ?? [])
        setTotal(res.data.total ?? 0)
      } else {
        toast.error(res.message || i18next.t('Failed to load billing history'))
        setRecords([])
        setTotal(0)
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to fetch org wallet ledger:', error)
      toast.error(i18next.t('Failed to load billing history'))
      setRecords([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [customerId, workspaceId, enabled, page, pageSize])

  useEffect(() => {
    void fetchLedger()
  }, [fetchLedger])

  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage)
  }, [])

  const handlePageSizeChange = useCallback((newPageSize: number) => {
    setPageSize(newPageSize)
    setPage(1)
  }, [])

  return {
    records,
    total,
    page,
    pageSize,
    loading,
    handlePageChange,
    handlePageSizeChange,
    refresh: fetchLedger,
  }
}
