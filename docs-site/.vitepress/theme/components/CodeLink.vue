<script setup lang="ts">
import { computed } from 'vue'
import { useData } from 'vitepress'
import { UI_TEXT, blobUrl, fileName, langOf } from '../meta'

/**
 * Link to a repository file on GitHub (master branch).
 * Usage: <CodeLink path="frontend/web/src/engine/risk.ts" /> (optional `label`).
 */
const props = defineProps<{ path: string; label?: string }>()
const { lang } = useData()

const href = computed(() => blobUrl(props.path))
const text = computed(() => props.label || fileName(props.path))
const title = computed(() => UI_TEXT[langOf(lang.value)].githubTitle + ': ' + props.path)
</script>

<template>
  <a class="ahi-codelink" :href="href" :title="title" target="_blank" rel="noreferrer"><code>{{ text }}</code></a>
</template>
