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
  ImagePlus,
  Loader2,
  Settings2,
  VideoIcon,
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
  fetchVideoContentBlob,
  fetchVideoStatus,
  getVideoTaskId,
  submitVideo,
  submitVideoWithReference,
} from './api'
import { ExperienceShell } from './components/experience-shell'
import { OptionChip } from './components/option-chip'
import {
  IMAGE_VIDEO_STUDIO_URL,
  VIDEO_POLL_INTERVAL_HIDDEN_MS,
  VIDEO_POLL_INTERVAL_MS,
} from './constants'
import { useExperiencePricing } from './hooks/use-experience-pricing'
import { mapVideoPixelSize } from './lib/estimate-cost'
import type { VideoTaskResponse } from './types'

type PreviewState = 'empty' | 'loading' | 'result' | 'failed'

const MODE_OPTIONS = [
  {
    value: 'i2v-first-frame',
    labelKey: 'Image to video (first frame)',
  },
  {
    value: 't2v',
    labelKey: 'Text to video',
  },
]

const RESOLUTION_OPTIONS = [
  { value: '720p', label: '720p' },
  { value: '1080p', label: '1080p' },
]

const RATIO_OPTIONS = [
  { value: '16:9', label: '16:9', box: 'h-4 w-7' },
  { value: '9:16', label: '9:16', box: 'h-7 w-4' },
  { value: '1:1', label: '1:1', box: 'size-5' },
  { value: '4:3', label: '4:3', box: 'h-4 w-6' },
  { value: '3:4', label: '3:4', box: 'h-6 w-4' },
]

const DURATION_OPTIONS = ['4', '5', '6', '8', '10', '12', '15'] as const

function sleep(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'))
      return
    }
    const timer = window.setTimeout(() => resolve(), ms)
    signal?.addEventListener(
      'abort',
      () => {
        window.clearTimeout(timer)
        reject(new DOMException('Aborted', 'AbortError'))
      },
      { once: true }
    )
  })
}

function formatVideoStatusLabel(
  status: string,
  t: (key: string) => string
): string {
  switch (status) {
    case 'queued':
      return t('Queued')
    case 'in_progress':
      return t('Processing')
    case 'completed':
      return t('Completed')
    case 'failed':
      return t('Failed')
    default:
      return status
  }
}

/**
 * Video generation experience — submit /pg/videos, poll status, preview content.
 */
export function ExperienceVideosPage() {
  const { t } = useTranslation()
  const [model, setModel] = useState('')
  const [mode, setMode] = useState(MODE_OPTIONS[1].value)
  const [prompt, setPrompt] = useState('')
  const [resolution, setResolution] = useState('720p')
  const [ratio, setRatio] = useState('16:9')
  const [duration, setDuration] = useState('4')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [previewState, setPreviewState] = useState<PreviewState>('empty')
  const [progressLabel, setProgressLabel] = useState('')
  const [progressPercent, setProgressPercent] = useState(0)
  const [errorMessage, setErrorMessage] = useState('')
  const [referenceFile, setReferenceFile] = useState<File | null>(null)
  const [videoObjectUrl, setVideoObjectUrl] = useState<string | null>(null)
  const [taskMeta, setTaskMeta] = useState<VideoTaskResponse | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoObjectUrlRef = useRef<string | null>(null)

  const { availableModels, displayText: estimatedCostText, isLoading } =
    useExperiencePricing({
      mode: 'videos',
      modelName: model,
      resolution,
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
      if (videoObjectUrlRef.current) {
        URL.revokeObjectURL(videoObjectUrlRef.current)
        videoObjectUrlRef.current = null
      }
    }
  }, [])

  const isImageToVideo = mode === 'i2v-first-frame'
  const settingsSummary = `${resolution} · ${ratio} · ${duration}s`
  const canGenerate = Boolean(model) && !isLoading

  const clearVideoUrl = () => {
    if (videoObjectUrlRef.current) {
      URL.revokeObjectURL(videoObjectUrlRef.current)
      videoObjectUrlRef.current = null
    }
    setVideoObjectUrl(null)
  }

  const setVideoUrl = (url: string) => {
    if (videoObjectUrlRef.current) {
      URL.revokeObjectURL(videoObjectUrlRef.current)
    }
    videoObjectUrlRef.current = url
    setVideoObjectUrl(url)
  }

  const pollUntilDone = async (
    taskId: string,
    signal: AbortSignal
  ): Promise<VideoTaskResponse> => {
    for (;;) {
      const status = await fetchVideoStatus(taskId, signal)
      const label = status.status || 'unknown'
      setProgressLabel(formatVideoStatusLabel(label, t))
      setProgressPercent(
        typeof status.progress === 'number' ? status.progress : 0
      )
      setTaskMeta(status)

      if (label === 'completed') return status
      if (label === 'failed') {
        throw new Error(
          status.error?.message || t('Generation failed')
        )
      }

      const interval = document.hidden
        ? VIDEO_POLL_INTERVAL_HIDDEN_MS
        : VIDEO_POLL_INTERVAL_MS
      await sleep(interval, signal)
    }
  }

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error(t('Please enter a prompt'))
      return
    }
    if (!model) {
      toast.error(t('No video models available'))
      return
    }
    if (isImageToVideo && !referenceFile) {
      toast.error(t('Please upload a first-frame image'))
      return
    }

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setSettingsOpen(false)
    setPreviewState('loading')
    setErrorMessage('')
    setProgressLabel(formatVideoStatusLabel('queued', t))
    setProgressPercent(0)
    setTaskMeta(null)
    clearVideoUrl()

    try {
      const payload = {
        model,
        prompt: prompt.trim(),
        seconds: duration,
        size: mapVideoPixelSize(resolution, ratio),
      }

      const submitted =
        isImageToVideo && referenceFile
          ? await submitVideoWithReference(
              { ...payload, file: referenceFile },
              controller.signal
            )
          : await submitVideo(payload, controller.signal)

      if (submitted.error?.message) {
        throw new Error(submitted.error.message)
      }

      const taskId = getVideoTaskId(submitted)
      if (!taskId) {
        throw new Error(t('No task id returned'))
      }

      setTaskMeta(submitted)
      setProgressLabel(
        formatVideoStatusLabel(submitted.status || 'queued', t)
      )
      setProgressPercent(submitted.progress ?? 0)

      const completed =
        submitted.status === 'completed'
          ? submitted
          : await pollUntilDone(taskId, controller.signal)

      const blob = await fetchVideoContentBlob(taskId, controller.signal)
      const objectUrl = URL.createObjectURL(blob)
      setVideoUrl(objectUrl)
      setTaskMeta(completed)
      setPreviewState('result')
    } catch (error) {
      if (controller.signal.aborted) return
      const message = extractRelayErrorMessage(
        error,
        t('Video generation failed')
      )
      setErrorMessage(message)
      setPreviewState('failed')
      toast.error(message)
    }
  }

  const handleDownload = () => {
    if (!videoObjectUrl) return
    const anchor = document.createElement('a')
    anchor.href = videoObjectUrl
    anchor.download = `experience-video-${Date.now()}.mp4`
    anchor.click()
  }

  return (
    <ExperienceShell
      mode='videos'
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
                    isLoading ? t('Loading models…') : t('Select model')
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
                {t('No video models available for your account')}
              </p>
            ) : null}
          </div>

          <div className='flex shrink-0 items-center justify-between gap-3'>
            <Label className='shrink-0'>{t('Mode')}</Label>
            <Select
              value={mode}
              items={MODE_OPTIONS.map((item) => ({
                value: item.value,
                label: t(item.labelKey),
              }))}
              onValueChange={(v) => setMode(v ?? MODE_OPTIONS[1].value)}
            >
              <SelectTrigger className='w-auto min-w-[11rem] max-w-[70%]'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MODE_OPTIONS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {t(item.labelKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isImageToVideo ? (
            <div className='grid shrink-0 gap-2'>
              <Label>{t('Reference content')}</Label>
              <input
                ref={fileInputRef}
                type='file'
                accept='image/*'
                className='hidden'
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null
                  setReferenceFile(file)
                }}
              />
              <button
                type='button'
                className='border-border hover:bg-muted/30 flex w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-8 text-center transition-colors'
                onClick={() => fileInputRef.current?.click()}
              >
                <ImagePlus className='text-muted-foreground size-7 opacity-70' />
                <div className='space-y-1'>
                  <p className='text-sm font-medium'>
                    {referenceFile
                      ? referenceFile.name
                      : t('Upload first-frame image')}
                  </p>
                  <p className='text-muted-foreground text-xs'>
                    {t('Use an image as the visual anchor for the video')}
                  </p>
                </div>
              </button>
            </div>
          ) : null}

          <div className='flex min-h-0 flex-1 flex-col gap-2'>
            <Label htmlFor='experience-video-prompt'>{t('Describe')}</Label>
            <Textarea
              id='experience-video-prompt'
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={t('Enter a prompt')}
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
                  <p className='text-sm font-medium'>{t('Clarity')}</p>
                  <div className='flex flex-wrap gap-2'>
                    {RESOLUTION_OPTIONS.map((item) => (
                      <OptionChip
                        key={item.value}
                        selected={resolution === item.value}
                        onClick={() => setResolution(item.value)}
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
                  <p className='text-sm font-medium'>{t('Clip duration')}</p>
                  <div className='grid grid-cols-4 gap-2'>
                    {DURATION_OPTIONS.map((item) => (
                      <OptionChip
                        key={item}
                        selected={duration === item}
                        onClick={() => setDuration(item)}
                        className='min-w-0'
                      >
                        {item}s
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
                t('Generate video')
              )}
            </Button>
          </div>
        </div>
      }
      canvas={
        <div className='flex h-full min-h-[280px] flex-col gap-3'>
          {previewState === 'empty' ? (
            <div className='text-muted-foreground flex flex-1 flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-8 text-center'>
              <VideoIcon className='size-10 opacity-40' />
              <p className='max-w-sm text-sm'>
                {t(
                  'Generated video will appear here after you submit a prompt.'
                )}
              </p>
            </div>
          ) : null}

          {previewState === 'loading' ? (
            <div className='flex flex-1 flex-col items-center justify-center gap-4 rounded-lg border border-dashed p-8'>
              <Loader2 className='text-muted-foreground size-8 animate-spin opacity-60' />
              <div className='space-y-1 text-center'>
                <p className='text-sm font-medium'>{t('Generating…')}</p>
                <p className='text-muted-foreground text-xs'>
                  {t('Status')}: {progressLabel}
                  {progressPercent > 0 ? ` · ${progressPercent}%` : ''}
                </p>
              </div>
              <div className='bg-muted h-1.5 w-48 overflow-hidden rounded-full'>
                <div
                  className='bg-primary/70 h-full rounded-full transition-all'
                  style={{
                    width: `${Math.min(100, Math.max(8, progressPercent || 12))}%`,
                  }}
                />
              </div>
            </div>
          ) : null}

          {previewState === 'result' && videoObjectUrl ? (
            <div className='bg-background border-border/70 flex flex-1 flex-col overflow-hidden rounded-lg border'>
              <div className='bg-black flex min-h-0 flex-1 items-center justify-center'>
                <video
                  src={videoObjectUrl}
                  controls
                  className='max-h-full max-w-full'
                />
              </div>
              <div className='flex items-center justify-between gap-2 border-t px-3 py-2'>
                <span className='text-muted-foreground truncate text-xs'>
                  {taskMeta?.model || model} · {resolution} · {ratio} ·{' '}
                  {duration}s
                </span>
                <Button
                  type='button'
                  size='sm'
                  variant='ghost'
                  onClick={handleDownload}
                >
                  <Download className='size-3.5' />
                  {t('Download')}
                </Button>
              </div>
            </div>
          ) : null}

          {previewState === 'failed' ? (
            <div className='border-destructive/30 bg-destructive/5 flex flex-1 flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-8 text-center'>
              <p className='text-destructive text-sm font-medium'>
                {t('Generation failed')}
              </p>
              <p className='text-muted-foreground max-w-sm text-xs'>
                {errorMessage ||
                  t(
                    'Upstream or quota errors will show here. Adjust the prompt and retry.'
                  )}
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
        </div>
      }
    />
  )
}
