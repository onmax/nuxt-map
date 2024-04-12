import { env } from 'node:process'
import { pwa } from './config/pwa'
import { appDescription } from './constants/index'
import { Provider } from './types/crypto-map'

export default defineNuxtConfig({
  modules: [
    '@vueuse/nuxt',
    '@unocss/nuxt',
    '@pinia/nuxt',
    '@nuxtjs/color-mode',
    '@vite-pwa/nuxt',
    'nuxt-module-eslint-config',
    '@nuxtjs/supabase',
  ],

  experimental: {
    // when using generate, payload js assets included in sw precache manifest
    // but missing on offline, disabling extraction it until fixed
    payloadExtraction: false,
    renderJsonPayloads: true,
    typedPages: true,
  },

  css: [
    '@unocss/reset/tailwind.css',
  ],

  supabase: {
    redirect: false,
  },

  runtimeConfig: {
    googleMapsApiKeyBackend: env.GOOGLE_MAPS_API_KEY_BACKEND,
    supabaseUrl: env.SUPABASE_URL,
    supabaseKey: env.SUPABASE_KEY,
    supabaseAdminUser: env.SUPABASE_ADMIN_USER,
    supabaseAdminPassword: env.SUPABASE_ADMIN_PASSWORD,

    providersSources: Object.values(Provider).reduce((acc, provider) => {
      acc[provider] = env[`PROVIDER_SOURCE_${provider.toLocaleUpperCase().replaceAll(' ', '_')}`]!
      return acc
    }, {} as Record<Provider, string>),
  },

  ignore: [
    'server/api/fetcher/lib',
  ],

  colorMode: {
    classSuffix: '',
  },

  nitro: {
    esbuild: {
      options: {
        target: 'esnext',
      },
    },
    prerender: {
      crawlLinks: false,
      routes: ['/'],
      ignore: ['/hi'],
    },
  },

  app: {
    head: {
      viewport: 'width=device-width,initial-scale=1',
      link: [
        { rel: 'icon', href: '/favicon.ico', sizes: 'any' },
        { rel: 'icon', type: 'image/svg+xml', href: '/nuxt.svg' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
      ],
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: appDescription },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
      ],
    },
  },

  pwa,

  devtools: {
    enabled: true,
  },

  features: {
    // For UnoCSS
    inlineStyles: false,
  },

  eslintConfig: {
    setup: false,
  },
})
