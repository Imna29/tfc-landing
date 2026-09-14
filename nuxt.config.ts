import prismicConfig from "./prismic.config.json";
// https://nuxt.com/docs/api/configuration/nuxt-config
import tailwindcss from "@tailwindcss/vite";
import { FUNCTION_REGION } from "./deployment";
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

  nitro: {
    vercel: {
      // Spread verbatim into the Function's `.vc-config.json` by Nitro's
      // Vercel preset, which is the only place a Build Output API deploy reads
      // a region from — the project's own setting is not consulted for a
      // `--prebuilt` deploy, and `vercel.json` is the Git integration's file,
      // which ADR-0019 turned off. Why it is set at all, and the rule for
      // changing it, are in ./deployment.ts.
      functions: { regions: [FUNCTION_REGION] },
    },
  },

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
