import prismicConfig from "./prismic.config.json";
// https://nuxt.com/docs/api/configuration/nuxt-config
import tailwindcss from "@tailwindcss/vite";
import { routeRules } from "./route-rules";

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

  modules: ["@nuxt/icon", "@nuxtjs/prismic", "motion-v/nuxt"],

  prismic: {
    endpoint: prismicConfig.repositoryName,

    clientConfig: {
      routes: prismicConfig.routes,
    },
  },

  runtimeConfig: {
    // Server-only. See `server/api/prismic/revalidate.post.ts`.
    prismicWebhookSecret: "",
    // Must match `nitro.vercel.config.bypassToken` below, which is read at
    // build time — so changing it needs a redeploy, not just a restart.
    revalidateBypassToken: "",
    // Defaults to the host Prismic called the webhook on.
    revalidateOrigin: "",
    prismicRepository: prismicConfig.repositoryName,
  },

  nitro: {
    vercel: {
      config: {
        // The Vercel preset writes this into every ISR route's prerender
        // config, which is what makes on-demand purging possible at all.
        bypassToken: process.env.NUXT_REVALIDATE_BYPASS_TOKEN,
      },
    },
  },

  // The cache boundary lives in ./route-rules.ts so it can be asserted on
  // directly. See ADR-0008.
  routeRules,
});
