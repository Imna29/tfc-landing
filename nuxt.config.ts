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
    // Server-only, all three. See `server/api/prismic/revalidate.post.ts`.

    /** Shared with Prismic, and the only guard on the purge endpoint. */
    prismicWebhookSecret: "",

    /**
     * The deployment's Vercel bypass token, so the purge endpoint can send it
     * back. It has to match `nitro.vercel.config.bypassToken` below, which is
     * read at build time — so this is the same variable read twice, once by the
     * build and once by the running server, and changing it needs a redeploy
     * rather than only a restart.
     */
    revalidateBypassToken: "",

    /**
     * Where to send the purge requests. Empty means the host Prismic called,
     * which is what you want unless the webhook is aimed at a different domain
     * from the one being refreshed.
     */
    revalidateOrigin: "",

    /** So the server can query Prismic without going through the Vue plugin. */
    prismicRepository: prismicConfig.repositoryName,
  },

  nitro: {
    vercel: {
      config: {
        // What makes on-demand purging possible at all: the Vercel preset
        // writes this into the `.prerender-config.json` of every ISR route, and
        // Vercel then honours `x-prerender-revalidate: <token>` on those routes.
        // Without it every page is stuck with the ten-minute expiry in
        // `route-rules.ts` and nothing can shorten it.
        bypassToken: process.env.NUXT_REVALIDATE_BYPASS_TOKEN,
      },
    },
  },

  // The cache boundary lives in ./route-rules.ts so it can be asserted on
  // directly. See ADR-0008.
  routeRules,
});
