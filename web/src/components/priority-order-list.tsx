/*
Copyright (C) 2023-2026 QuantumNous
*/
import {
  ArrowDown01Icon,
  ArrowUp01Icon,
  Cancel01Icon,
  Drag01Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { Reorder, useDragControls } from 'motion/react'
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type PriorityOrderItem = {
  id: number
  label: string
  description?: ReactNode
}

type PriorityOrderListProps = {
  items: PriorityOrderItem[]
  /** Called when order is committed (drag end / move buttons). First id = highest priority. */
  onReorder: (orderedIds: number[]) => void
  onRemove?: (id: number) => void
  disabled?: boolean
  className?: string
  emptyText?: string
}

function PriorityOrderRow({
  item,
  index,
  count,
  disabled,
  onMove,
  onRemove,
  onDragEnd,
}: {
  item: PriorityOrderItem
  index: number
  count: number
  disabled?: boolean
  onMove: (index: number, direction: 'up' | 'down') => void
  onRemove?: (id: number) => void
  onDragEnd: () => void
}) {
  const { t } = useTranslation()
  const dragControls = useDragControls()

  const handleDragStart = (event: PointerEvent<HTMLButtonElement>) => {
    if (disabled) return
    dragControls.start(event)
  }

  const handleDragKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      onMove(index, 'up')
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      onMove(index, 'down')
    }
  }

  return (
    <Reorder.Item
      value={item.id}
      dragListener={false}
      dragControls={dragControls}
      onDragEnd={onDragEnd}
      className='bg-background flex items-center gap-2 rounded-lg border p-2'
    >
      <Button
        type='button'
        variant='ghost'
        size='icon-sm'
        className='text-muted-foreground cursor-grab touch-none font-mono active:cursor-grabbing'
        disabled={disabled}
        aria-label={t('Drag {{name}} to reorder', { name: item.label })}
        onPointerDown={handleDragStart}
        onKeyDown={handleDragKeyDown}
      >
        <HugeiconsIcon icon={Drag01Icon} strokeWidth={2} aria-hidden='true' />
      </Button>
      <span className='text-muted-foreground w-6 shrink-0 text-center text-xs tabular-nums'>
        #{index + 1}
      </span>
      <div className='min-w-0 flex-1'>
        <div className='truncate text-sm font-medium'>{item.label}</div>
        {item.description ? (
          <div className='text-muted-foreground truncate text-xs'>
            {item.description}
          </div>
        ) : null}
      </div>
      <div className='flex shrink-0 gap-1'>
        <Button
          type='button'
          variant='ghost'
          size='icon-sm'
          disabled={disabled || index === 0}
          aria-label={t('Move {{name}} up', { name: item.label })}
          onClick={() => onMove(index, 'up')}
        >
          <HugeiconsIcon
            icon={ArrowUp01Icon}
            strokeWidth={2}
            aria-hidden='true'
          />
        </Button>
        <Button
          type='button'
          variant='ghost'
          size='icon-sm'
          disabled={disabled || index === count - 1}
          aria-label={t('Move {{name}} down', { name: item.label })}
          onClick={() => onMove(index, 'down')}
        >
          <HugeiconsIcon
            icon={ArrowDown01Icon}
            strokeWidth={2}
            aria-hidden='true'
          />
        </Button>
        {onRemove ? (
          <Button
            type='button'
            variant='ghost'
            size='icon-sm'
            disabled={disabled}
            aria-label={t('Remove {{name}}', { name: item.label })}
            onClick={() => onRemove(item.id)}
          >
            <HugeiconsIcon
              icon={Cancel01Icon}
              strokeWidth={2}
              aria-hidden='true'
            />
          </Button>
        ) : null}
      </div>
    </Reorder.Item>
  )
}

/**
 * Drag-to-reorder list. Items are shown highest-priority first (#1 at top).
 * API commit happens on drag end / up-down buttons (not on every drag frame).
 */
export function PriorityOrderList({
  items,
  onReorder,
  onRemove,
  disabled,
  className,
  emptyText,
}: PriorityOrderListProps) {
  const { t } = useTranslation()
  const [order, setOrder] = useState(items)
  const orderRef = useRef(order)
  orderRef.current = order

  const itemsKey = items.map((item) => item.id).join(',')
  useEffect(() => {
    setOrder(items)
  }, [items, itemsKey])

  if (order.length === 0) {
    return (
      <p className='text-muted-foreground text-sm'>
        {emptyText || t('No items')}
      </p>
    )
  }

  const commit = (next: PriorityOrderItem[]) => {
    setOrder(next)
    onReorder(next.map((item) => item.id))
  }

  const handleMove = (index: number, direction: 'up' | 'down') => {
    const target = direction === 'up' ? index - 1 : index + 1
    if (target < 0 || target >= order.length) return
    const next = [...order]
    ;[next[index], next[target]] = [next[target], next[index]]
    commit(next)
  }

  return (
    <Reorder.Group
      axis='y'
      values={order.map((item) => item.id)}
      onReorder={(ids) => {
        if (disabled) return
        const byId = new Map(order.map((item) => [item.id, item]))
        const next = ids
          .map((id) => byId.get(id as number))
          .filter((item): item is PriorityOrderItem => Boolean(item))
        setOrder(next)
      }}
      className={cn('space-y-2', className)}
    >
      {order.map((item, index) => (
        <PriorityOrderRow
          key={item.id}
          item={item}
          index={index}
          count={order.length}
          disabled={disabled}
          onMove={handleMove}
          onRemove={onRemove}
          onDragEnd={() => {
            if (disabled) return
            onReorder(orderRef.current.map((row) => row.id))
          }}
        />
      ))}
    </Reorder.Group>
  )
}
