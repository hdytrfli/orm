import { defineConfig } from 'vitepress';
import { generateSidebar } from 'vitepress-sidebar';

export default defineConfig({
  title: 'Mongorm',
  description: 'A TypeScript-first MongoDB ORM built on native Zod schemas.',
  cleanUrls: true,
  themeConfig: {
    nav: [
      { text: 'Guide', link: '/guide/introduction' },
      { text: 'API', link: '/api/schema' },
      { text: 'npm', link: 'https://www.npmjs.com/package/@mongorm/orm' },
    ],
    sidebar: generateSidebar({
      documentRootPath: '.',
      collapsed: false,
      sortMenusBy: 'displayOrder',
      useTitleFromFileHeading: true,
      hyphenToSpace: true,
      capitalizeFirst: true,
    }),
    socialLinks: [],
    footer: {
      message: 'Released under the MIT License.',
    },
  },
});
