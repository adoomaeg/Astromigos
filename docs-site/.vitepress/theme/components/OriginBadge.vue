<script setup lang="ts">
import { computed } from 'vue'
import { useData } from 'vitepress'
import { ORIGIN_TEXT, langOf, parseOrigins } from '../meta'

/**
 * Data origin badge(s). Accepts one origin or a comma separated list:
 * <OriginBadge origin="REAL_PUBLIC" /> or <OriginBadge origin="SIMULATED, MANUAL" />.
 * The visible text is the canonical code (as in the app); the tooltip explains it in the page language.
 */
const props = defineProps<{ origin: string }>()
const { lang } = useData()

const items = computed(() =>
  parseOrigins(props.origin).map((o) => ({
    key: o,
    cls: 'is-' + o.toLowerCase().replace(/_/g, '-'),
    ...ORIGIN_TEXT[o][langOf(lang.value)],
  })),
)
</script>

<template>
  <span class="ahi-origin-group"
    ><span
      v-for="item in items"
      :key="item.key"
      class="ahi-badge ahi-origin"
      :class="item.cls"
      :title="item.title"
      role="note"
      :aria-label="item.title"
      >{{ item.key }}</span
    ></span
  >
</template>
