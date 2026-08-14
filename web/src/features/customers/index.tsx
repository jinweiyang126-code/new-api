/*
Copyright (C) 2023-2026 QuantumNous
*/
import { useTranslation } from 'react-i18next'

import { SectionPageLayout } from '@/components/layout'

import { CustomerTopupDialog } from './components/customer-topup-dialog'
import { CustomersCreateDrawer } from './components/customers-create-drawer'
import { CustomersDetailDrawer } from './components/customers-detail-drawer'
import { CustomersEditDrawer } from './components/customers-edit-drawer'
import { CustomersPrimaryButtons } from './components/customers-primary-buttons'
import {
  CustomersProvider,
  useCustomers,
} from './components/customers-provider'
import { CustomersStatusDialog } from './components/customers-status-dialog'
import { CustomersTable } from './components/customers-table'

function CustomersContent() {
  const { t } = useTranslation()
  const { open, setOpen, currentRow, triggerRefresh } = useCustomers()

  return (
    <>
      <SectionPageLayout fixedContent>
        <SectionPageLayout.Title>
          {t('Customer Management')}
        </SectionPageLayout.Title>
        <SectionPageLayout.Actions>
          <CustomersPrimaryButtons />
        </SectionPageLayout.Actions>
        <SectionPageLayout.Content>
          <CustomersTable />
        </SectionPageLayout.Content>
      </SectionPageLayout>

      <CustomersCreateDrawer
        open={open === 'create'}
        onOpenChange={(isOpen) => !isOpen && setOpen(null)}
      />
      <CustomersEditDrawer
        open={open === 'update'}
        onOpenChange={(isOpen) => !isOpen && setOpen(null)}
        customer={currentRow}
      />
      <CustomersDetailDrawer
        open={open === 'detail'}
        onOpenChange={(isOpen) => !isOpen && setOpen(null)}
        customer={currentRow}
      />
      <CustomersStatusDialog />
      {currentRow ? (
        <CustomerTopupDialog
          open={open === 'topup'}
          onOpenChange={(isOpen) => !isOpen && setOpen(null)}
          customerId={currentRow.id}
          currentQuota={currentRow.quota}
          onSuccess={triggerRefresh}
        />
      ) : null}
    </>
  )
}

export function Customers() {
  return (
    <CustomersProvider>
      <CustomersContent />
    </CustomersProvider>
  )
}
