<script setup lang="ts">
import { computed } from 'vue'
import { useData, withBase } from 'vitepress'
import StatusBadge from './StatusBadge.vue'
import OriginBadge from './OriginBadge.vue'
import CodeLink from './CodeLink.vue'
import { UI_TEXT, langOf, normalizeStatus, parseOrigins, toList } from '../meta'

/**
 * Compact page header injected in the `doc-before` layout slot.
 * Breadcrumbs come from the active (localized) sidebar; the rest from the page frontmatter:
 * status, origin, code, tests, verified. Only the breadcrumbs show when those keys are absent.
 */
type SidebarLink = { text?: string; link?: string; items?: SidebarLink[] }

const { frontmatter, page, theme, lang, site, localeIndex } = useData()

const t = computed(() => UI_TEXT[langOf(lang.value)])

const current = computed(() => '/' + page.value.relativePath.replace(/(^|\/)index\.md$/, '$1').replace(/\.md$/, ''))

const homeLink = computed(() => {
  const locales = site.value.locales as Record<string, { link?: string }> | undefined
  return locales?.[localeIndex.value]?.link || '/'
})

const crumbs = computed(() => {
  const sidebar = theme.value.sidebar as SidebarLink[] | undefined
  if (!Array.isArray(sidebar)) return null
  for (const group of sidebar) {
    const hit = group.items?.find((i) => i.link && i.link.replace(/\.html$/, '') === current.value)
    if (hit) {
      return {
        section: group.text ?? '',
        sectionLink: group.items?.[0]?.link,
        page: hit.text ?? String(frontmatter.value.title ?? ''),
      }
    }
  }
  return null
})

const status = computed(() => (normalizeStatus(frontmatter.value.status) ? String(frontmatter.value.status) : ''))
const origin = computed(() => parseOrigins(frontmatter.value.origin).join(', '))
const code = computed(() => toList(frontmatter.value.code))
const tests = computed(() => toList(frontmatter.value.tests))
const verified = computed(() => {
  const v = frontmatter.value.verified as unknown
  if (!v) return ''
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  const s = String(v)
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : s
})
const hasMeta = computed(() => !!(status.value || origin.value || code.value.length || tests.value.length || verified.value))
</script>

<template>
  <div v-if="crumbs || hasMeta" class="ahi-pagemeta">
    <nav v-if="crumbs" class="ahi-crumbs" :aria-label="t.breadcrumb">
      <a :href="withBase(homeLink)">{{ t.home }}</a>
      <span class="sep" aria-hidden="true">/</span>
      <a v-if="crumbs.sectionLink && crumbs.sectionLink !== current" :href="withBase(crumbs.sectionLink)">{{ crumbs.section }}</a>
      <span v-else>{{ crumbs.section }}</span>
      <span class="sep" aria-hidden="true">/</span>
      <span aria-current="page">{{ crumbs.page }}</span>
    </nav>

    <div v-if="hasMeta" class="ahi-meta-bar" role="group" :aria-label="t.pageInfo">
      <div v-if="status || origin || verified" class="ahi-meta-row">
        <span v-if="status" class="ahi-meta-item">
          <span class="ahi-meta-key">{{ t.status }}</span>
          <StatusBadge :status="status" />
        </span>
        <span v-if="origin" class="ahi-meta-item">
          <span class="ahi-meta-key">{{ t.origin }}</span>
          <OriginBadge :origin="origin" />
        </span>
        <span v-if="verified" class="ahi-meta-item ahi-meta-verified" :title="t.verifiedTitle">
          {{ t.verified }} <time :datetime="verified">{{ verified }}</time>
        </span>
      </div>
      <div v-if="code.length" class="ahi-meta-row">
        <span class="ahi-meta-key">{{ t.code }}</span>
        <span class="ahi-meta-links">
          <CodeLink v-for="p in code" :key="p" :path="p" />
        </span>
      </div>
      <div v-if="tests.length" class="ahi-meta-row">
        <span class="ahi-meta-key">{{ t.tests }}</span>
        <span class="ahi-meta-links">
          <CodeLink v-for="p in tests" :key="p" :path="p" />
        </span>
      </div>
    </div>
  </div>
</template>
