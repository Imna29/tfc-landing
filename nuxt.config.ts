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
    '/**': { isr: 600 },
    '/slice-simulator': { ssr: true },
    '/slice-simulator/**': { ssr: true },
  },
});
