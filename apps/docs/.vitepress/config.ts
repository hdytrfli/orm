import { defineConfig } from 'vitepress';
import { generateSidebar } from 'vitepress-sidebar';

export default defineConfig({
  title: 'Mongorm',
  description: 'A TypeScript-first MongoDB ORM built on native Zod schemas.',
  cleanUrls: true,
  themeConfig: {
    nav: [
      { text: 'Getting Started', link: '/getting-started/' },
      { text: 'Schemas', link: '/schemas/' },
      { text: 'Queries', link: '/queries/' },
      { text: 'TypeScript', link: '/typescript/' },
      { text: 'API Reference', link: '/reference/' },
      { text: 'npm', link: 'https://www.npmjs.com/package/@mongorm/orm' },
    ],
    sidebar: generateSidebar({
      documentRootPath: '.',
      collapsed: false,
      useTitleFromFileHeading: true,
      hyphenToSpace: true,
      capitalizeFirst: true,
    }),
    socialLinks: [],
    search: { provider: 'local' },
    footer: {
      message: 'Released under the MIT License.',
    },
  },
});
