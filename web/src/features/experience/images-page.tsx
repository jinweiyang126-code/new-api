/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import {
  ChevronDown,
  Download,
  ImageIcon,
  Loader2,
  Settings2,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

import {
  extractRelayErrorMessage,
  generateImages,
  mapImageResponseToItems,
} from './api'
import { ExperienceShell } from './components/experience-shell'
import { OptionChip } from './components/option-chip'
import { IMAGE_VIDEO_STUDIO_URL } from './constants'
import { useExperiencePricing } from './hooks/use-experience-pricing'
import { mapAspectRatioToImageSize } from './lib/estimate-cost'
import type { GeneratedImageItem } from './types'

type PreviewState = 'empty' | 'loading' | 'result' | 'failed'

const SIZE_OPTIONS = [
  { value: '1K', label: '1K' },
  { value: '2K', label: '2K' },
]

const RATIO_OPTIONS = [
  { value: '16:9', label: '16:9', box: 'h-4 w-7' },
  { value: '9:16', label: '9:16', box: 'h-7 w-4' },
  { value: '1:1', label: '1:1', box: 'size-5' },
  { value: '4:3', label: '4:3', box: 'h-4 w-6' },
  { value: '3:4', label: '3:4', box: 'h-6 w-4' },
]

const COUNT_OPTIONS = ['1', '2', '4'] as const

function resolveImageSize(sizeLabel: string, aspectRatio: string): string {
  const base = mapAspectRatioToImageSize(aspectRatio)
  if (sizeLabel !== '2K') return base
  // Scale common square / landscape / portrait bases for "2K" UI preset.
  if (base === '1024x1024') return '2048x2048'
  if (base === '1792x1024') return '2048x1152'
  if (base === '1024x1792') return '1152x2048'
  return base
}

/**
 * Image generation experience — left form + right canvas, via /pg/images/generations.
 */
export function ExperienceImagesPage() {
  const { t } = useTranslation()
  const [model, setModel] = useState('')
  const [prompt, setPrompt] = useState('')
  const [size, setSize] = useState('2K')
  const [ratio, setRatio] = useState('16:9')
  const [count, setCount] = useState('1')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [previewState, setPreviewState] = useState<PreviewState>('empty')
  const [results, setResults] = useState<GeneratedImageItem[]>([])
  const [errorMessage, setErrorMessage] = useState('')
  const abortRef = useRef<AbortController | null>(null)

  const { availableModels, displayText: estimatedCostText, isLoading } =
    useExperiencePricing({
      mode: 'images',
      modelName: model,
      aspectRatio: ratio,
    })

  const modelOptions = useMemo(
    () =>
      availableModels.map((item) => ({
        value: item.model_name,
        label: item.model_name,
      })),
    [availableModels]
  )

  useEffect(() => {
    if (modelOptions.length === 0) {
      if (model) setModel('')
      return
    }
    if (!modelOptions.some((item) => item.value === model)) {
      setModel(modelOptions[0].value)
    }
  }, [modelOptions, model])

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  const settingsSummary = `${size} · ${ratio} · ${count}${t('images unit')}`
  const canGenerate = Boolean(model) && !isLoading

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error(t('Please enter a prompt'))
      return
    }
    if (!model) {
      toast.error(t('No image models available'))
      return
    }

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setSettingsOpen(false)
    setPreviewState('loading')
    setErrorMessage('')
    setResults([])

    try {
      const n = Number(count) || 1
      const response = await generateImages(
        {
          model,
          prompt: prompt.trim(),
          n,
          size: resolveImageSize(size, ratio),
        },
        controller.signal
      )

      if (response.error?.message) {
        throw new Error(response.error.message)
      }

      const items = mapImageResponseToItems(response)
      if (items.length === 0) {
        throw new Error(t('No images returned'))
      }

      setResults(items)
      setPreviewState('result')
    } catch (error) {
      if (controller.signal.aborted) return
      const message = extractRelayErrorMessage(
        error,
        t('Image generation failed')
      )
      setErrorMessage(message)
      setPreviewState('failed')
      toast.error(message)
    }
  }

  const handleDownload = async (item: GeneratedImageItem, index: number) => {
    try {
      const response = await fetch(item.src)
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `experience-image-${index + 1}.png`
      anchor.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error(t('Download failed'))
    }
  }

  return (
    <ExperienceShell
      mode='images'
      logsLabel={t('Image and video studio')}
      logsTo={IMAGE_VIDEO_STUDIO_URL}
      form={
        <>
          <div className='grid shrink-0 gap-2'>
            <Select
              value={model || undefined}
              items={modelOptions}
              onValueChange={(v) => setModel(v ?? modelOptions[0]?.value ?? '')}
            >
              <SelectTrigger className='w-full' disabled={modelOptions.length === 0}>
                <SelectValue
                  placeholder={
                    isLoading
                      ? t('Loading models…')
                      : t('Select model')
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {modelOptions.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!isLoading && modelOptions.length === 0 ? (
              <p className='text-muted-foreground text-xs'>
                {t('No image models available for your account')}
              </p>
            ) : null}
          </div>

          <div className='flex min-h-0 flex-1 flex-col gap-2'>
            <Label htmlFor='experience-image-prompt'>{t('Describe')}</Label>
            <Textarea
              id='experience-image-prompt'
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={t('Describe the image you want to generate')}
              className='field-sizing-fixed min-h-0 max-h-none h-full flex-1 resize-none'
            />
          </div>
        </>
      }
      formFooter={
        <div className='space-y-3'>
          <div className='text-muted-foreground flex items-center justify-between gap-3 text-xs'>
            <span>{t('Estimated cost')}</span>
            <span>{estimatedCostText}</span>
          </div>
          <div className='flex items-center gap-2'>
            <Popover open={settingsOpen} onOpenChange={setSettingsOpen}>
              <PopoverTrigger
                render={
                  <Button
                    type='button'
                    variant='outline'
                    className='min-w-0 flex-1 justify-between gap-2'
                  />
                }
              >
                <span className='flex min-w-0 items-center gap-2'>
                  <Settings2 className='size-4 shrink-0' />
                  <span className='truncate'>{settingsSummary}</span>
                </span>
                <ChevronDown className='size-4 shrink-0 opacity-70' />
              </PopoverTrigger>
              <PopoverContent
                side='top'
                align='start'
                sideOffset={8}
                className='w-[min(100vw-2rem,22rem)] gap-3 p-3'
              >
                <div className='grid gap-2'>
                  <p className='text-sm font-medium'>{t('Size')}</p>
                  <div className='flex flex-wrap gap-2'>
                    {SIZE_OPTIONS.map((item) => (
                      <OptionChip
                        key={item.value}
                        selected={size === item.value}
                        onClick={() => setSize(item.value)}
                      >
                        {item.label}
                      </OptionChip>
                    ))}
                  </div>
                </div>

                <div className='grid gap-2'>
                  <p className='text-sm font-medium'>{t('Aspect ratio')}</p>
                  <div className='flex flex-wrap gap-2'>
                    {RATIO_OPTIONS.map((item) => (
                      <OptionChip
                        key={item.value}
                        selected={ratio === item.value}
                        onClick={() => setRatio(item.value)}
                        className='h-auto min-w-14 flex-col gap-1.5 px-2.5 py-2'
                      >
                        <span
                          className={cn(
                            'rounded-[2px] border border-current/40',
                            item.box
                          )}
                        />
                        <span className='text-xs'>{item.label}</span>
                      </OptionChip>
                    ))}
                  </div>
                </div>

                <div className='grid gap-2'>
                  <p className='text-sm font-medium'>{t('Number of images')}</p>
                  <div className='flex flex-wrap gap-2'>
                    {COUNT_OPTIONS.map((item) => (
                      <OptionChip
                        key={item}
                        selected={count === item}
                        onClick={() => setCount(item)}
                        className='min-w-12'
                      >
                        {item}
                      </OptionChip>
                    ))}
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            <Button
              type='button'
              className='shrink-0'
              disabled={!canGenerate || previewState === 'loading'}
              onClick={() => void handleGenerate()}
            >
              {previewState === 'loading' ? (
                <>
                  <Loader2 className='size-4 animate-spin' />
                  {t('Generating…')}
                </>
              ) : (
                t('Generate image')
              )}
            </Button>
          </div>
        </div>
      }
      canvas={
        <div className='flex h-full min-h-[280px] flex-col gap-3'>
          {previewState === 'empty' ? (
            <div className='text-muted-foreground flex flex-1 flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-8 text-center'>
              <ImageIcon className='size-10 opacity-40' />
              <p className='max-w-sm text-sm'>
                {t(
                  'Generated images will appear here after you submit a prompt.'
                )}
              </p>
            </div>
          ) : null}

          {previewState === 'loading' ? (
            <div className='text-muted-foreground flex flex-1 flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-8'>
              <Loader2 className='size-8 animate-spin opacity-60' />
              <p className='text-sm'>{t('Generating…')}</p>
            </div>
          ) : null}

          {previewState === 'failed' ? (
            <div className='border-destructive/30 bg-destructive/5 flex flex-1 flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-8 text-center'>
              <p className='text-destructive text-sm font-medium'>
                {t('Generation failed')}
              </p>
              <p className='text-muted-foreground max-w-sm text-xs'>
                {errorMessage ||
                  t('Upstream or quota errors will show here. Adjust the prompt and retry.')}
              </p>
              <Button
                type='button'
                size='sm'
                variant='outline'
                onClick={() => void handleGenerate()}
              >
                {t('Retry')}
              </Button>
            </div>
          ) : null}

          {previewState === 'result' ? (
            <div
              className={cn(
                'min-h-0 flex-1 gap-3',
                results.length === 1
                  ? 'flex flex-col overflow-hidden'
                  : 'grid grid-cols-1 overflow-y-auto sm:grid-cols-2'
              )}
            >
              {results.map((item, i) => (
                <div
                  key={item.src}
                  className={cn(
                    'bg-background border-border/70 relative flex flex-col overflow-hidden rounded-lg border',
                    results.length === 1
                      ? 'min-h-0 flex-1'
                      : 'aspect-square max-h-[min(100%,420px)]'
                  )}
                >
                  <div className='bg-muted/30 flex min-h-0 flex-1 items-center justify-center overflow-hidden'>
                    <img
                      src={item.src}
                      alt={item.revisedPrompt || `${t('Generated image')} ${i + 1}`}
                      className='max-h-full max-w-full object-contain'
                    />
                  </div>
                  <div className='flex shrink-0 items-center justify-between gap-2 border-t px-3 py-2'>
                    <span className='text-muted-foreground truncate text-xs'>
                      {model} · {size} · {ratio}
                    </span>
                    <Button
                      type='button'
                      size='sm'
                      variant='ghost'
                      onClick={() => void handleDownload(item, i)}
                    >
                      <Download className='size-3.5' />
                      {t('Download')}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      }
    />
  )
}
