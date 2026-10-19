import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';
import { defineConfig } from 'vite';
import type { VitePluginPWAAPI } from 'vite-plugin-pwa';

const staticAdapter = adapter({ fallback: '200.html' });
const pwaPlugins = SvelteKitPWA({
  strategies: 'generateSW',
  registerType: 'prompt',
  injectRegister: false,
  outDir: 'build',
  // Registration must resolve from the origin root on a first visit to a deep link.
  buildBase: '/',
  scope: '/',
  includeAssets: ['icons/*.png', 'favicon.svg'],
  manifest: {
    id: '/',
    name: 'WtReps',
    short_name: 'WtReps',
    description: 'Local-first machine workout tracking.',
    lang: 'en',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    theme_color: '#173d35',
    background_color: '#f7f8f5',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  },
  workbox: {
    // Generate from final static output, after adapter-static writes 200.html.
    globDirectory: 'build',
    globPatterns: ['**/*.{html,js,css,png,svg,webmanifest}'],
    globIgnores: ['sw.js', 'workbox-*.js'],
    modifyURLPrefix: {},
    manifestTransforms: [],
    navigateFallback: '/200.html',
    cleanupOutdatedCaches: true,
    skipWaiting: false,
    clientsClaim: false,
  },
});

// These HTML transforms are unused: manifest/icons are linked in app.html and
// development service workers are disabled. Kit 3 does not support that hook.
const plugins = pwaPlugins.filter(
  (plugin) => !['vite-plugin-pwa:dev-sw', 'vite-plugin-pwa:pwa-assets'].includes(plugin.name),
);

export default defineConfig({
  plugins: [
    sveltekit({
      adapter: {
        ...staticAdapter,
        async adapt(builder) {
          await staticAdapter.adapt(builder);
          // @vite-pwa/sveltekit 1.1 uses the pre-Kit-3 closeBundle lifecycle.
          // Use its public generation API after the static adapter instead.
          const api = pwaPlugins.find((plugin) => plugin.name === 'vite-plugin-pwa')?.api as
            VitePluginPWAAPI | undefined;
          if (!api) throw new Error('PWA generation API is unavailable.');
          await api.generateSW();
        },
      },
      serviceWorker: { register: false },
      version: { pollInterval: 0 },
    }),
    ...plugins,
  ],
});
