import prismicConfig from "./prismic.config.json";
// https://nuxt.com/docs/api/configuration/nuxt-config
import tailwindcss from "@tailwindcss/vite";
import { FUNCTION_REGION } from "./deployment";
import { routeRules } from "./route-rules";

/**
 * The deployment's bypass token, which is what lets the Prismic webhook purge
 * a page instead of waiting out `isr: 600`. Read here, at build time, because
 * the Vercel preset writes it into every ISR route's prerender config.
 *
 * Vercel refuses a `Prerender` whose token is shorter than 32 characters, and
 * refuses the whole deployment with it — so an environment that has no token
 * has to produce a build output without the field rather than one Vercel
 * rejects. Left out, the webhook answers 503 naming the variable that is
 * missing and the ten-minute expiry goes on being the backstop, which is a
 * deploy somebody can read a message off rather than a deploy that is red for
 * everyone. See ADR-0019 for why the build happens in the workflow at all, and
 * the Prismic section of README.md for where the value comes from.
 */
const bypassToken = process.env.NUXT_REVALIDATE_BYPASS_TOKEN;
const prerender = bypassToken && bypassToken.length >= 32 ? { bypassToken } : {};

if (process.env.NITRO_PRESET === "vercel" && !("bypassToken" in prerender)) {
  console.warn(
    "[nuxt.config] NUXT_REVALIDATE_BYPASS_TOKEN is unset or under 32 characters." +
      " Building without it: a Prismic publish will wait out the ten-minute edge cache" +
      " and /api/prismic/revalidate will answer 503.",
  );
}

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

  // The cache boundary lives in ./route-rules.ts so it can be asserted on
  // directly. See ADR-0008.
  routeRules,

  nitro: {
    vercel: {
      // Spread into every ISR route's prerender config, which is what makes
      // on-demand purging possible at all. Empty when there is no usable token
      // — see `prerender` above.
      config: prerender,

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
