import { defineConfig } from 'vitepress';
import { generateSidebar } from 'vitepress-sidebar';

export default defineConfig({
  title: 'Mongorm',
  description: 'A TypeScript-first MongoDB ORM built on native Zod schemas.',
  cleanUrls: true,
  appearance: 'force-dark',
  themeConfig: {
    nav: [
      { text: 'Getting Started', link: '/getting-started/' },
      { text: 'Schemas', link: '/schemas/' },
      { text: 'Queries', link: '/queries/' },
      { text: 'npm', link: 'https://www.npmjs.com/package/@mongorm/orm' },
      { text: 'github', link: 'https://github.com/hdytrfli/orm' },
    ],
    sidebar: generateSidebar({
      documentRootPath: '.',
      collapsed: false,
      sortMenusByCustomFunction: (a, b) => (a.frontmatter.order ?? 0) - (b.frontmatter.order ?? 0),
      hyphenToSpace: true,
      capitalizeFirst: true,
      useTitleFromFileHeading: true,
    }),
    logo: { src: '/logo.svg', alt: 'Mongorm' },
    socialLinks: [],
    search: { provider: 'local' },
    footer: {
      message: 'Released under the GNU General Public License v3.0.',
    },
  },
  head: [
    [
      'link',
      {
        rel: 'icon',
        href: '/logo.svg',
      },
    ],
    ['link', { rel: 'preconnect', href: 'https://fonts.bunny.net' }],
    [
      'link',
      {
        rel: 'stylesheet',
        href: 'https://fonts.bunny.net/css?family=geist:400,500,600,700',
      },
    ],
  ],
});
