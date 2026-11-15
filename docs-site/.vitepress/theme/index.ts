import { h } from 'vue'
import DefaultTheme from 'vitepress/theme'
import type { Theme } from 'vitepress'
import StatusBadge from './components/StatusBadge.vue'
import OriginBadge from './components/OriginBadge.vue'
import CodeLink from './components/CodeLink.vue'
import PageMeta from './components/PageMeta.vue'
import './custom.css'

export default {
  extends: DefaultTheme,
  // PageMeta renders breadcrumbs plus the status / origin / code / tests / verified bar from frontmatter.
  Layout: () =>
    h(DefaultTheme.Layout, null, {
      'doc-before': () => h(PageMeta),
    }),
  enhanceApp({ app }) {
    app.component('StatusBadge', StatusBadge)
    app.component('OriginBadge', OriginBadge)
    app.component('CodeLink', CodeLink)
  },
} satisfies Theme
