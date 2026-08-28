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
/**
 * LobeHub Icon Loader — loads icons on demand (no `import * as` barrel).
 *
 * Supports:
 * - Basic: "OpenAI", "OpenAI.Color"
 * - Chained properties: "OpenAI.Avatar.type={'platform'}"
 * - Size parameter: getLobeIcon("OpenAI", 20)
 */
import {
  useEffect,
  useState,
  type ComponentType,
  type ReactNode,
} from 'react'

import { IconSub2api } from '@/assets/custom/icon-sub2api'

type IconProps = Record<string, string | number | boolean | undefined>

type LobeIconModule = ComponentType<IconProps> &
  Record<string, ComponentType<IconProps> | string | number | undefined>

const CUSTOM_ICONS: Record<string, ComponentType<{ size?: number }>> = {
  Sub2API: IconSub2api,
}

/** Cache resolved icon modules so repeat renders do not re-fetch. */
const moduleCache = new Map<string, LobeIconModule | null>()
const moduleInflight = new Map<string, Promise<LobeIconModule | null>>()

function parseValue(raw: string | undefined | null): string | number | boolean {
  if (raw == null) return true

  let v = String(raw).trim()

  if (v.startsWith('{') && v.endsWith('}')) {
    v = v.slice(1, -1).trim()
  }

  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    return v.slice(1, -1)
  }

  if (v === 'true') return true
  if (v === 'false') return false

  if (/^-?\d+(?:\.\d+)?$/.test(v)) return Number(v)

  return v
}

function FallbackGlyph(props: { label: string; size: number }) {
  return (
    <div
      className='bg-muted text-muted-foreground flex items-center justify-center rounded-full text-xs font-medium'
      style={{ width: props.size, height: props.size }}
    >
      {props.label}
    </div>
  )
}

function isSafeIconKey(key: string): boolean {
  return /^[A-Za-z][A-Za-z0-9]*$/.test(key)
}

/**
 * Dynamically import a single brand icon package entry.
 * Bundler creates async chunks per icon — not the full @lobehub/icons barrel.
 */
function loadLobeIconModule(baseKey: string): Promise<LobeIconModule | null> {
  if (!isSafeIconKey(baseKey)) return Promise.resolve(null)

  const cached = moduleCache.get(baseKey)
  if (cached !== undefined) return Promise.resolve(cached)

  const inflight = moduleInflight.get(baseKey)
  if (inflight) return inflight

  const promise = import(
    /* webpackChunkName: "lobe-icon-[request]" */
    /* webpackMode: "lazy" */
    /* webpackInclude: /[\\/]@lobehub[\\/]icons[\\/]es[\\/][A-Za-z][A-Za-z0-9]*[\\/]index\.js$/ */
    /* webpackExclude: /[\\/](components|features|hooks|toc|types)[\\/]/ */
    `@lobehub/icons/es/${baseKey}/index.js`
  )
    .then((mod) => {
      const resolved = (mod.default ?? mod) as LobeIconModule
      moduleCache.set(baseKey, resolved)
      return resolved
    })
    .catch(() => {
      moduleCache.set(baseKey, null)
      return null
    })
    .finally(() => {
      moduleInflight.delete(baseKey)
    })

  moduleInflight.set(baseKey, promise)
  return promise
}

function resolveIconComponent(
  BaseIcon: LobeIconModule,
  segments: string[]
): {
  IconComponent: ComponentType<IconProps> | undefined
  propStartIndex: number
} {
  if (segments.length > 1 && BaseIcon[segments[1]]) {
    const nested = BaseIcon[segments[1]]
    if (typeof nested === 'function' || typeof nested === 'object') {
      return {
        IconComponent: nested as ComponentType<IconProps>,
        propStartIndex: 2,
      }
    }
  }

  return {
    IconComponent: BaseIcon as ComponentType<IconProps>,
    propStartIndex:
      segments.length > 1 && /^[A-Z]/.test(segments[1] ?? '') ? 2 : 1,
  }
}

function buildIconProps(
  segments: string[],
  propStartIndex: number,
  size: number
): IconProps {
  const props: IconProps = {}

  for (let i = propStartIndex; i < segments.length; i++) {
    const seg = segments[i]
    if (!seg) continue

    const eqIdx = seg.indexOf('=')
    if (eqIdx === -1) {
      props[seg.trim()] = true
      continue
    }

    const key = seg.slice(0, eqIdx).trim()
    const valRaw = seg.slice(eqIdx + 1).trim()
    props[key] = parseValue(valRaw)
  }

  if (props.size == null && size != null) {
    props.size = size
  }

  return props
}

export type LobeIconProps = {
  name: string | undefined | null
  size?: number
}

/**
 * Async LobeHub icon. Prefer this in new code; `getLobeIcon` wraps it for
 * drop-in compatibility with existing call sites.
 */
export function LobeIcon(props: LobeIconProps) {
  const size = props.size ?? 20
  const trimmedName =
    typeof props.name === 'string' ? props.name.trim() : ''

  const [BaseIcon, setBaseIcon] = useState<LobeIconModule | null | undefined>(
    () => {
      if (!trimmedName) return null
      const baseKey = trimmedName.split('.')[0] ?? ''
      if (CUSTOM_ICONS[baseKey]) return undefined
      return moduleCache.has(baseKey) ? moduleCache.get(baseKey) : undefined
    }
  )

  useEffect(() => {
    if (!trimmedName) {
      setBaseIcon(null)
      return
    }

    const segments = trimmedName.split('.')
    const baseKey = segments[0] ?? ''
    if (CUSTOM_ICONS[baseKey]) {
      setBaseIcon(undefined)
      return
    }

    if (moduleCache.has(baseKey)) {
      setBaseIcon(moduleCache.get(baseKey))
      return
    }

    let cancelled = false
    loadLobeIconModule(baseKey)
      .then((mod) => {
        if (!cancelled) setBaseIcon(mod)
      })
      .catch(() => {
        if (!cancelled) setBaseIcon(null)
      })
    return () => {
      cancelled = true
    }
  }, [trimmedName])

  if (!trimmedName) {
    return <FallbackGlyph label='?' size={size} />
  }

  const segments = trimmedName.split('.')
  const baseKey = segments[0] ?? ''
  const CustomIcon = CUSTOM_ICONS[baseKey]
  if (CustomIcon) {
    return <CustomIcon size={size} />
  }

  if (BaseIcon === undefined) {
    return (
      <FallbackGlyph
        label={trimmedName.charAt(0).toUpperCase() || '?'}
        size={size}
      />
    )
  }

  if (!BaseIcon) {
    return (
      <FallbackGlyph
        label={trimmedName.charAt(0).toUpperCase() || '?'}
        size={size}
      />
    )
  }

  const { IconComponent, propStartIndex } = resolveIconComponent(
    BaseIcon,
    segments
  )

  if (
    !IconComponent ||
    (typeof IconComponent !== 'function' && typeof IconComponent !== 'object')
  ) {
    return (
      <FallbackGlyph
        label={trimmedName.charAt(0).toUpperCase() || '?'}
        size={size}
      />
    )
  }

  const iconProps = buildIconProps(segments, propStartIndex, size)
  return <IconComponent {...iconProps} />
}

/**
 * Drop-in helper used across pricing / channels / rankings.
 * Returns an async {@link LobeIcon} — does **not** pull the full icons barrel.
 */
export function getLobeIcon(
  iconName: string | undefined | null,
  size: number = 20
): ReactNode {
  return <LobeIcon name={iconName} size={size} />
}
