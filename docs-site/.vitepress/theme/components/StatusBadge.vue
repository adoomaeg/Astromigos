<script setup lang="ts">
import { computed } from 'vue'
import { useData } from 'vitepress'
import { STATUS_TEXT, langOf, normalizeStatus } from '../meta'

/**
 * Implementation status badge. Text label plus tooltip, never color only.
 * Usage: <StatusBadge status="PLANNED" /> (optional `label` overrides the visible text).
 */
const props = defineProps<{ status: string; label?: string }>()
const { lang } = useData()

const key = computed(() => normalizeStatus(props.status))
const text = computed(() => (key.value ? STATUS_TEXT[key.value][langOf(lang.value)] : null))
const cls = computed(() => (key.value ? 'is-' + key.value.toLowerCase().replace(/_/g, '-') : ''))
</script>

<template>
  <span v-if="key && text" class="ahi-badge ahi-status" :class="cls" :title="text.title" role="note" :aria-label="text.title"
    ><span class="ahi-badge-dot" aria-hidden="true"></span>{{ label || text.label }}</span
  >
  <span v-else class="ahi-badge" :title="status">{{ label || status }}</span>
</template>
