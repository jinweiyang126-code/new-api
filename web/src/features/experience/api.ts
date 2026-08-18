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
import axios from 'axios'

import { api } from '@/lib/api'

import { EXPERIENCE_API } from './constants'
import type {
  GeneratedImageItem,
  ImageGenerationRequest,
  ImageGenerationResponse,
  ImageTaskResponse,
  VideoSubmitRequest,
  VideoTaskResponse,
} from './types'

export function extractRelayErrorMessage(
  error: unknown,
  fallback = 'Request failed'
): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as
      | {
          error?: { message?: string; Message?: string }
          message?: string
          Message?: string
        }
      | string
      | undefined

    if (typeof data === 'string' && data.trim()) return data
    if (data && typeof data === 'object') {
      const nested = data.error?.message || data.error?.Message
      if (nested) return nested
      if (data.message) return data.message
      if (data.Message) return data.Message
    }
    if (error.message) return error.message
  }
  if (error instanceof Error && error.message) return error.message
  return fallback
}

export async function generateImages(
  payload: ImageGenerationRequest,
  signal?: AbortSignal
): Promise<ImageGenerationResponse | ImageTaskResponse> {
  const res = await api.post(EXPERIENCE_API.IMAGE_GENERATIONS, payload, {
    signal,
    skipErrorHandler: true,
  } as Record<string, unknown>)
  return res.data
}

export function isImageTaskResponse(
  response: ImageGenerationResponse | ImageTaskResponse
): response is ImageTaskResponse {
  if (!response || typeof response !== 'object') return false
  if ('data' in response && Array.isArray(response.data) && response.data.length > 0) {
    return false
  }
  const task = response as ImageTaskResponse
  return Boolean(task.id || task.task_id || task.status)
}

export async function fetchImageStatus(
  taskId: string,
  signal?: AbortSignal
): Promise<ImageTaskResponse> {
  const res = await api.get(EXPERIENCE_API.imageStatus(taskId), {
    signal,
    skipErrorHandler: true,
  } as Record<string, unknown>)
  return res.data
}

export function getImageTaskId(task: ImageTaskResponse): string | undefined {
  return task.id || task.task_id
}

function isUsableImageSrc(url: string): boolean {
  const value = url.trim()
  if (!value) return false
  if (value.startsWith('data:image/')) return true
  if (value.includes('/v1/videos/') && value.includes('/content')) return false
  return (
    /^https?:\/\//i.test(value) ||
    value.startsWith('/') ||
    value.startsWith('data:')
  )
}

function urlsFromUnknown(value: unknown): string[] {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return []
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      try {
        return urlsFromUnknown(JSON.parse(trimmed))
      } catch {
        return isUsableImageSrc(trimmed) ? [trimmed] : []
      }
    }
    return isUsableImageSrc(trimmed) ? [trimmed] : []
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => urlsFromUnknown(item))
  }
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>
    for (const key of ['url', 'b64_json', 'imageUrl', 'image_url', 'src']) {
      if (!(key in obj)) continue
      if (key === 'b64_json' && typeof obj.b64_json === 'string' && obj.b64_json) {
        return [`data:image/png;base64,${obj.b64_json}`]
      }
      const found = urlsFromUnknown(obj[key])
      if (found.length > 0) return found
    }
  }
  return []
}

export function mapImageTaskToItems(task: ImageTaskResponse): GeneratedImageItem[] {
  const revised = task.metadata?.revised_prompt
  const urls = [
    ...urlsFromUnknown(task.metadata?.images),
    ...urlsFromUnknown(task.metadata?.url),
    ...urlsFromUnknown(task.data),
  ].filter(isUsableImageSrc)
  return [...new Set(urls)].map((url) => ({
    src: url,
    revisedPrompt: revised,
  }))
}

export function mapImageResponseToItems(
  response: ImageGenerationResponse
): GeneratedImageItem[] {
  const items = response.data ?? []
  const mapped: GeneratedImageItem[] = []
  for (const item of items) {
    if (item.url) {
      mapped.push({ src: item.url, revisedPrompt: item.revised_prompt })
      continue
    }
    if (item.b64_json) {
      mapped.push({
        src: `data:image/png;base64,${item.b64_json}`,
        revisedPrompt: item.revised_prompt,
      })
    }
  }
  return mapped
}

export async function submitVideo(
  payload: VideoSubmitRequest,
  signal?: AbortSignal
): Promise<VideoTaskResponse> {
  const res = await api.post(EXPERIENCE_API.VIDEO_SUBMIT, payload, {
    signal,
    skipErrorHandler: true,
  } as Record<string, unknown>)
  return res.data
}

export async function submitVideoWithReference(
  payload: VideoSubmitRequest & { file: File },
  signal?: AbortSignal
): Promise<VideoTaskResponse> {
  const form = new FormData()
  form.append('model', payload.model)
  form.append('prompt', payload.prompt)
  if (payload.seconds) form.append('seconds', payload.seconds)
  if (payload.size) form.append('size', payload.size)
  form.append('input_reference', payload.file)

  const res = await api.post(EXPERIENCE_API.VIDEO_SUBMIT, form, {
    signal,
    skipErrorHandler: true,
    headers: { 'Content-Type': 'multipart/form-data' },
  } as Record<string, unknown>)
  return res.data
}

export async function fetchVideoStatus(
  taskId: string,
  signal?: AbortSignal
): Promise<VideoTaskResponse> {
  const res = await api.get(EXPERIENCE_API.videoStatus(taskId), {
    signal,
    skipErrorHandler: true,
  } as Record<string, unknown>)
  return res.data
}

export async function fetchVideoContentBlob(
  taskId: string,
  signal?: AbortSignal
): Promise<Blob> {
  const res = await api.get(EXPERIENCE_API.videoContent(taskId), {
    signal,
    responseType: 'blob',
    skipErrorHandler: true,
  } as Record<string, unknown>)
  return res.data as Blob
}

export function getVideoTaskId(task: VideoTaskResponse): string | undefined {
  return task.id || task.task_id
}
