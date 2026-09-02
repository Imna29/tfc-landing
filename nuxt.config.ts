import prismicConfig from "./prismic.config.json";
// https://nuxt.com/docs/api/configuration/nuxt-config
import tailwindcss from "@tailwindcss/vite";
import { routeRules } from "./route-rules";

export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  devtools: { enabled: true },
  css: ["~/assets/main.css"],

  vite: {
    plugins: [tailwindcss()],
    optimizeDeps: {
      include: ["@vue/devtools-core", "@vue/devtools-kit"],
    },
  },

  modules: ["@nuxt/icon", "@nuxtjs/prismic", "motion-v/nuxt"],

  prismic: {
    endpoint: prismicConfig.repositoryName,

    clientConfig: {
      routes: prismicConfig.routes,
    },
  },

  // The cache boundary lives in ./route-rules.ts so it can be asserted on
  // directly. See ADR-0008.
  routeRules,

  router: {
    options: {
      // Vue Router matches case-insensitively by default and Nitro's route
      // rules do not, so `/PROFILE` rendered the signed-in page while missing
      // the rule that exempts `/profile` from the edge cache. See ADR-0012:
      // one spelling per URL is what keeps the served paths and the exempted
      // paths the same set.
      sensitive: true,
    },
  },
});
