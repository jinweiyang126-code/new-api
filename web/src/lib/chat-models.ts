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
const CHAT_ENDPOINTS = new Set([
  'openai',
  'openai-response',
  'openai-response-compact',
  'anthropic',
  'gemini',
])

const NON_TEXT_ENDPOINTS = new Set([
  'image-generation',
  'openai-video',
  'jina-rerank',
  'embeddings',
])

const NON_TEXT_NAME_PATTERN =
  /seedance|seedream|dall-e|dalle|flux[-_.]?|imagen|kling|midjourney|\bmj\b|suno|stable-diffusion|sdxl|recraft|ideogram|luma|runway|pika|\bveo\b|\bsora\b|wanx|cogvideox|embedding|rerank|whisper|\btts\b|(?:^|[-_])video(?:$|[-_])|[-_](i2v|t2v)(?:$|[-_])|\bimage\b/i

export function isLikelyNonTextModelName(name: string): boolean {
  return NON_TEXT_NAME_PATTERN.test(name)
}

export function isTextChatModel(
  name: string,
  endpoints?: readonly string[] | null
): boolean {
  if (endpoints && endpoints.length > 0) {
    if (endpoints.some((endpoint) => NON_TEXT_ENDPOINTS.has(endpoint))) {
      return false
    }
    if (endpoints.some((endpoint) => CHAT_ENDPOINTS.has(endpoint))) {
      return true
    }
    return false
  }

  return !isLikelyNonTextModelName(name)
}
