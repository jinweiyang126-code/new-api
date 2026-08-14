/*
Copyright (C) 2023-2026 QuantumNous
*/
import { createSectionRegistry } from '@/features/system-settings/utils/section-registry'

const MEMBERS_SECTIONS = [
  {
    id: 'members',
    titleKey: 'Members',
    build: () => null,
  },
  {
    id: 'invitations',
    titleKey: 'Invitations',
    build: () => null,
  },
] as const

export type MembersSectionId = (typeof MEMBERS_SECTIONS)[number]['id']

const membersRegistry = createSectionRegistry<
  MembersSectionId,
  Record<string, never>,
  []
>({
  sections: MEMBERS_SECTIONS,
  defaultSection: 'members',
  basePath: '/members',
  urlStyle: 'path',
})

export const MEMBERS_SECTION_IDS = membersRegistry.sectionIds
export const MEMBERS_DEFAULT_SECTION = membersRegistry.defaultSection
