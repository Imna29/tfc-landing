import prismicConfig from "./prismic.config.json";
// https://nuxt.com/docs/api/configuration/nuxt-config
import tailwindcss from "@tailwindcss/vite";

export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  devtools: { enabled: true },
  css: ["./app/assets/main.css"],

  vite: {
    plugins: [tailwindcss()],
    optimizeDeps: {
      include: ["@vue/devtools-core", "@vue/devtools-kit"],
    },
  },

  modules: ["@nuxt/icon", "@nuxtjs/prismic", "@nuxtjs/i18n", "motion-v/nuxt"],

  prismic: {
    endpoint: prismicConfig.repositoryName,

    clientConfig: {
      routes: prismicConfig.routes,
    },
  },
  i18n: {
    locales: [
      { code: "en-us", name: "English" },
      { code: "ka", name: "Georgian" },
    ],
    defaultLocale: "en-us",
  },

  routeRules: {
    // Static pages — cache for 10 minutes and revalidate in background
    "/": { swr: 600 },
    "/ka": { swr: 600 },
    "/contact": { swr: 600 },
    "/ka/contact": { swr: 600 },
    "/terms-of-service": { swr: 600 },
    "/ka/terms-of-service": { swr: 600 },
    "/privacy-policy": { swr: 600 },
    "/ka/privacy-policy": { swr: 600 },

    // Slice simulator is a dev tool — keep it client-side only
    "/slice-simulator": { ssr: false },
    "/ka/slice-simulator": { ssr: false },

    // Fighter profiles — cache for 10 minutes and revalidate in background
    "/fighters/**": { swr: 600 },
    "/ka/fighters/**": { swr: 600 },

    // Catch-all for dynamic CMS pages — cache for 10 minutes and revalidate in background
    "/**": { swr: 600 },
    "/ka/**": { swr: 600 },
  },
});
