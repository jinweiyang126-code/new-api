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
export type ImageGenerationRequest = {
  model: string
  prompt: string
  n?: number
  size?: string
  quality?: string
  response_format?: 'url' | 'b64_json'
}

export type ImageGenerationData = {
  url?: string
  b64_json?: string
  revised_prompt?: string
}

export type ImageGenerationResponse = {
  created?: number
  data?: ImageGenerationData[]
  error?: { message?: string; code?: string | number; type?: string }
}

export type VideoSubmitRequest = {
  model: string
  prompt: string
  seconds?: string
  size?: string
}

export type VideoStatus =
  | 'queued'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'unknown'
  | string

export type VideoTaskResponse = {
  id?: string
  task_id?: string
  object?: string
  model?: string
  status?: VideoStatus
  progress?: number
  created_at?: number
  completed_at?: number
  seconds?: string
  size?: string
  error?: { message?: string; code?: string }
}

export type GeneratedImageItem = {
  src: string
  revisedPrompt?: string
}
