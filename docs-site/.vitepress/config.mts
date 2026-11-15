import { defineConfig, type DefaultTheme } from 'vitepress'
import { withMermaid } from 'vitepress-plugin-mermaid'
import footnote from 'markdown-it-footnote'

/**
 * Astronaut Health Intelligence Platform documentation portal.
 * English is the root locale; Brazilian Portuguese lives under /pt/ with the same file paths.
 * Sidebar group order follows the portal spec table. The same page list feeds both locales.
 */

const SITE_NAME = 'Astronaut Health Intelligence Platform'
const BASE = '/astronaut-health-intelligence-platform/'
const REPO = 'https://github.com/lucaspalharesbarbosa/astronaut-health-intelligence-platform'

type Page = { path: string; en: string; pt: string }
type Section = { key: string; en: string; pt: string; pages: Page[] }

/** Single source of truth for the page tree (EN and PT labels). */
const SECTIONS: Section[] = [
  {
    key: 'overview',
    en: 'Overview',
    pt: 'Visão geral',
    pages: [
      { path: 'overview/introduction', en: 'Introduction', pt: 'Introdução' },
      { path: 'overview/use-cases', en: 'Use Cases & Stakeholders', pt: 'Casos de uso e partes interessadas' },
      { path: 'overview/feature-status', en: 'Feature Status Matrix', pt: 'Matriz de status das funcionalidades' },
      { path: 'overview/responsible-use', en: 'Responsible Use', pt: 'Uso responsável' },
      { path: 'overview/glossary', en: 'Glossary & Acronyms', pt: 'Glossário e siglas' },
    ],
  },
  {
    key: 'science',
    en: 'Science',
    pt: 'Ciência',
    pages: [
      { path: 'science/spaceflight-hazards', en: 'Spaceflight Health Hazards', pt: 'Riscos à saúde em voos espaciais' },
      { path: 'science/monitored-physiology', en: 'Monitored Physiology', pt: 'Fisiologia monitorada' },
      { path: 'science/radiation-and-environment', en: 'Radiation & Cabin Environment', pt: 'Radiação e ambiente da cabine' },
      { path: 'science/health-monitoring-in-missions', en: 'Health Monitoring in Space Missions', pt: 'Monitoramento de saúde em missões' },
      { path: 'science/references', en: 'Scientific References', pt: 'Referências científicas' },
    ],
  },
  {
    key: 'data',
    en: 'Data',
    pt: 'Dados',
    pages: [
      { path: 'data/data-origins', en: 'Data Origins & Provenance', pt: 'Origens e proveniência dos dados' },
      { path: 'data/sources', en: 'NASA Data Sources', pt: 'Fontes de dados da NASA' },
      { path: 'data/dataset-catalog', en: 'Dataset Catalog', pt: 'Catálogo de datasets' },
      { path: 'data/data-dictionary', en: 'Data Dictionary', pt: 'Dicionário de dados' },
      { path: 'data/pipeline-and-quality', en: 'Pipeline, Normalization & Quality', pt: 'Pipeline, normalização e qualidade' },
      { path: 'data/anatomy-assets', en: '3D Anatomy Assets', pt: 'Assets de anatomia 3D' },
      { path: 'data/governance-and-privacy', en: 'Governance & Privacy', pt: 'Governança e privacidade' },
    ],
  },
  {
    key: 'intelligence',
    en: 'Health Intelligence',
    pt: 'Inteligência de saúde',
    pages: [
      { path: 'intelligence/overview', en: 'Overview & Methods Status', pt: 'Visão geral e status dos métodos' },
      { path: 'intelligence/personal-baseline', en: 'Personal Baseline', pt: 'Linha de base pessoal' },
      { path: 'intelligence/anomaly-detection', en: 'Anomaly Detection', pt: 'Detecção de anomalias' },
      { path: 'intelligence/risk-assessment', en: 'Risk Assessment', pt: 'Avaliação de risco' },
      { path: 'intelligence/forecasting', en: 'Forecasting', pt: 'Previsão' },
      { path: 'intelligence/recommendations', en: 'Recommendations, Autonomy & What-if', pt: 'Recomendações, autonomia e what-if' },
      { path: 'intelligence/alerts', en: 'Alerts & Escalation', pt: 'Alertas e escalonamento' },
      { path: 'intelligence/scenario-simulation', en: 'Device Simulation & Scenarios', pt: 'Simulação de dispositivos e cenários' },
      { path: 'intelligence/self-report-and-earth-link', en: 'Self-report & Earth Link', pt: 'Autorrelato e link com a Terra' },
      { path: 'intelligence/ai-and-analytics', en: 'AI & Analytics Approach', pt: 'Abordagem de IA e análise de dados' },
      { path: 'intelligence/thresholds', en: 'Thresholds & Limitations', pt: 'Limiares e limitações' },
    ],
  },
  {
    key: 'architecture',
    en: 'Architecture',
    pt: 'Arquitetura',
    pages: [
      { path: 'architecture/overview', en: 'Architecture Overview', pt: 'Visão geral da arquitetura' },
      { path: 'architecture/frontend', en: 'Frontend & State', pt: 'Frontend e estado' },
      { path: 'architecture/engine-and-simulation', en: 'Engine & Simulation', pt: 'Motor e simulação' },
      { path: 'architecture/data-model', en: 'Data Model & Contracts', pt: 'Modelo de dados e contratos' },
      { path: 'architecture/anatomy-3d', en: '3D Anatomy Rendering', pt: 'Renderização da anatomia 3D' },
      { path: 'architecture/target-architecture', en: 'Target Architecture', pt: 'Arquitetura alvo' },
    ],
  },
  {
    key: 'product',
    en: 'Product',
    pt: 'Produto',
    pages: [
      { path: 'product/product-tour', en: 'Product Tour', pt: 'Tour do produto' },
      { path: 'product/user-journeys', en: 'User Journeys & Roles', pt: 'Jornadas de usuário e papéis' },
      { path: 'product/mission-features', en: 'Mission Features', pt: 'Recursos da missão' },
      { path: 'product/demo-scenarios', en: 'Demo Scenarios & Guided Demo', pt: 'Cenários e demo guiada' },
      { path: 'product/design-system', en: 'Design System & Accessibility', pt: 'Design system e acessibilidade' },
    ],
  },
  {
    key: 'engineering',
    en: 'Engineering',
    pt: 'Engenharia',
    pages: [
      { path: 'engineering/quick-start', en: 'Setup, Commands & Troubleshooting', pt: 'Configuração, comandos e problemas' },
      { path: 'engineering/project-structure', en: 'Project Structure', pt: 'Estrutura do projeto' },
      { path: 'engineering/contributing', en: 'Standards, Contracts & Extending', pt: 'Padrões, contratos e extensões' },
      { path: 'engineering/testing', en: 'Testing Strategy', pt: 'Estratégia de testes' },
      { path: 'engineering/deployment', en: 'Documentation & Deployment', pt: 'Documentação e deploy' },
    ],
  },
  {
    key: 'validation',
    en: 'Validation',
    pt: 'Validação',
    pages: [
      { path: 'validation/strategy', en: 'Validation Strategy', pt: 'Estratégia de validação' },
      { path: 'validation/results', en: 'Results & Evidence', pt: 'Resultados e evidências' },
      { path: 'validation/model-card', en: 'Model Card', pt: 'Model card' },
      { path: 'validation/limitations', en: 'Limitations & Known Issues', pt: 'Limitações e problemas conhecidos' },
      { path: 'validation/traceability', en: 'Traceability Matrix', pt: 'Matriz de rastreabilidade' },
    ],
  },
  {
    key: 'resources',
    en: 'Resources',
    pt: 'Recursos',
    pages: [
      { path: 'resources/roadmap', en: 'Roadmap', pt: 'Roadmap' },
      { path: 'resources/nasa-resources', en: 'NASA & Technical Resources', pt: 'Recursos da NASA e técnicos' },
    ],
  },
]

type Lang = 'en' | 'pt'

const prefix = (lang: Lang) => (lang === 'pt' ? '/pt/' : '/')
const section = (key: string) => SECTIONS.find((s) => s.key === key)!
const first = (lang: Lang, key: string) => prefix(lang) + section(key).pages[0].path

function buildSidebar(lang: Lang): DefaultTheme.SidebarItem[] {
  return SECTIONS.map((s) => ({
    text: s[lang],
    collapsed: false,
    items: s.pages.map((p) => ({ text: p[lang], link: prefix(lang) + p.path })),
  }))
}

function buildNav(lang: Lang): DefaultTheme.NavItem[] {
  const p = lang === 'pt' ? '\\/pt' : ''
  const t = (en: string, pt: string) => (lang === 'pt' ? pt : en)
  const item = (key: string) => ({ text: section(key)[lang], link: first(lang, key), activeMatch: `^${p}/${key}/` })
  return [
    { ...item('overview') },
    {
      text: t('Science & Data', 'Ciência e dados'),
      activeMatch: `^${p}/(science|data)/`,
      items: [item('science'), item('data')],
    },
    {
      text: t('Platform', 'Plataforma'),
      activeMatch: `^${p}/(intelligence|architecture|product)/`,
      items: [item('intelligence'), item('architecture'), item('product')],
    },
    { ...item('engineering') },
    {
      text: t('Validation', 'Validação'),
      activeMatch: `^${p}/(validation|resources)/`,
      items: [item('validation'), item('resources')],
    },
  ]
}

const editLinkPattern = `${REPO}/edit/master/docs-site/:path`

export default withMermaid(
  defineConfig({
    title: SITE_NAME,
    titleTemplate: `:title | ${SITE_NAME}`,
    description:
      'Astronaut Health Intelligence Platform: predictive health monitoring and explainable decision support for astronauts on long duration missions. NASA Space Apps Challenge 2026.',
    base: BASE,
    cleanUrls: true,
    lastUpdated: false,
    appearance: 'dark',
    // Links to the local dev server (http://localhost:5173) are expected; every other link is checked.
    ignoreDeadLinks: 'localhostLinks',

    head: [
      ['link', { rel: 'icon', type: 'image/svg+xml', href: `${BASE}favicon.svg` }],
      ['meta', { name: 'theme-color', content: '#0b1220' }],
      ['meta', { property: 'og:type', content: 'website' }],
      ['meta', { property: 'og:site_name', content: SITE_NAME }],
      ['meta', { property: 'og:title', content: SITE_NAME }],
      [
        'meta',
        {
          property: 'og:description',
          content: 'Predictive health monitoring and explainable decision support for astronauts. Decision support only, not a medical device.',
        },
      ],
    ],

    markdown: {
      config: (md) => {
        md.use(footnote)
      },
    },

    locales: {
      root: {
        label: 'English',
        lang: 'en-US',
        themeConfig: {
          nav: buildNav('en'),
          sidebar: buildSidebar('en'),
          editLink: { pattern: editLinkPattern, text: 'Edit this page on GitHub' },
          footer: {
            message: `${SITE_NAME}. Decision support only: not a diagnosis and not a medical device. Device data is simulated.`,
            copyright: 'NASA Space Apps Challenge 2026',
          },
          outline: { level: [2, 3], label: 'On this page' },
          docFooter: { prev: 'Previous page', next: 'Next page' },
          lastUpdated: { text: 'Last updated' },
          darkModeSwitchLabel: 'Appearance',
          lightModeSwitchTitle: 'Switch to light theme',
          darkModeSwitchTitle: 'Switch to dark theme',
          returnToTopLabel: 'Return to top',
          sidebarMenuLabel: 'Menu',
          langMenuLabel: 'Change language',
          skipToContentLabel: 'Skip to content',
        },
      },
      pt: {
        label: 'Português',
        lang: 'pt-BR',
        link: '/pt/',
        description:
          'Astronaut Health Intelligence Platform: monitoramento preditivo de saúde e apoio à decisão explicável para astronautas em missões de longa duração. NASA Space Apps Challenge 2026.',
        themeConfig: {
          nav: buildNav('pt'),
          sidebar: buildSidebar('pt'),
          editLink: { pattern: editLinkPattern, text: 'Editar esta página no GitHub' },
          footer: {
            message: `${SITE_NAME}. Apenas apoio à decisão: não é diagnóstico nem dispositivo médico. Os dados dos dispositivos são simulados.`,
            copyright: 'NASA Space Apps Challenge 2026',
          },
          outline: { level: [2, 3], label: 'Nesta página' },
          docFooter: { prev: 'Página anterior', next: 'Próxima página' },
          lastUpdated: { text: 'Atualizado em' },
          darkModeSwitchLabel: 'Aparência',
          lightModeSwitchTitle: 'Mudar para o tema claro',
          darkModeSwitchTitle: 'Mudar para o tema escuro',
          returnToTopLabel: 'Voltar ao topo',
          sidebarMenuLabel: 'Menu',
          langMenuLabel: 'Mudar idioma',
          skipToContentLabel: 'Pular para o conteúdo',
          notFound: {
            title: 'PÁGINA NÃO ENCONTRADA',
            quote: 'Esta página não existe ou foi movida.',
            linkLabel: 'Ir para o início',
            linkText: 'Voltar ao início',
          },
        },
      },
    },

    themeConfig: {
      logo: { src: '/logo.svg', alt: 'Astronaut Health Intelligence Platform logo' },
      siteTitle: SITE_NAME,
      socialLinks: [{ icon: 'github', link: REPO, ariaLabel: 'Astronaut Health Intelligence Platform on GitHub' }],
      search: {
        provider: 'local',
        options: {
          locales: {
            pt: {
              translations: {
                button: { buttonText: 'Buscar', buttonAriaLabel: 'Buscar na documentação' },
                modal: {
                  displayDetails: 'Mostrar lista detalhada',
                  resetButtonTitle: 'Limpar a busca',
                  backButtonTitle: 'Fechar a busca',
                  noResultsText: 'Nenhum resultado para',
                  footer: {
                    selectText: 'selecionar',
                    selectKeyAriaLabel: 'enter',
                    navigateText: 'navegar',
                    navigateUpKeyAriaLabel: 'seta para cima',
                    navigateDownKeyAriaLabel: 'seta para baixo',
                    closeText: 'fechar',
                    closeKeyAriaLabel: 'esc',
                  },
                },
              },
            },
          },
        },
      },
    },

    // Mermaid ships as one large lazy chunk; the default 500 kB warning is expected noise here.
    // fastdom (a CommonJS dependency of mermaid 11) must be pre-bundled for the dev server.
    vite: {
      build: { chunkSizeWarningLimit: 3000 },
      optimizeDeps: { include: ['mermaid', 'mermaid > fastdom', 'mermaid > fastdom/extensions/fastdom-promised'] },
    },

    mermaid: {},
    mermaidPlugin: { class: 'mermaid ahi-mermaid' },
  }),
)
