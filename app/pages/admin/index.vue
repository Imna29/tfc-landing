<script setup lang="ts">
import type { Fan } from "#shared/fan";

/**
 * The index of the admin area.
 *
 * Deliberately plain. There is no separate admin application and no design
 * pass on this side of the site — the live lock console (#20) is the one
 * screen that gets one, because it is the one used cageside on a phone. What
 * this page is for is being the place an admin starts from, listing the
 * capabilities as they get built.
 *
 * Nothing here is what keeps a fan out: `server/middleware/admin.ts` refuses
 * the request before this page is rendered at all.
 */
useSeoMeta({
  title: "Admin",
  description: "Running TFC Predictions.",
  robots: "noindex",
});

const request = useRequestFetch();

// Asked of the admin area rather than of `/api/accounts/me`, so the page
// renders from the same answer that decides whether it may be rendered.
const { data: admin } = await useAsyncData("admin", () =>
  request<Pick<Fan, "username">>("/api/admin/me"),
);

// On the server this cannot happen: the middleware refused everyone else
// before this page was rendered at all. On a client-side navigation nothing
// has asked the server anything, and rendering the shell for a fan who cannot
// use it would be the hiding-navigation mistake in reverse — it would look
// like it had worked.
if (!admin.value) {
  throw createError({ statusCode: 403, statusMessage: "Admins only", fatal: true });
}

/**
 * What an admin can do, listed as it gets built: one entry added by each
 * ticket that adds a capability — importing a card, pricing it, opening and
 * locking Bouts, entering results, running Seasons.
 */
const capabilities: { title: string; description: string; to: string }[] = [
  {
    title: "Events",
    description:
      "Import a fight card out of Prismic. The copy in the game is what fans predict on, and " +
      "a card can only be re-imported while every Bout on it is still closed.",
    to: "/admin/events",
  },
  {
    title: "Seasons",
    description:
      "Open a Season. Every fan starts it on the same Coins, and nothing anywhere adds any " +
      "while it is being played.",
    to: "/admin/seasons",
  },
];
</script>

<template>
  <PageHeading text="Admin" />

  <section class="px-6 md:px-20 pb-24">
    <div class="max-w-2xl mx-auto">
      <p v-if="admin" class="text-on-surface/80">Signed in as {{ admin.username }}.</p>

      <h2 class="font-headline text-2xl font-black italic uppercase mt-10">Capabilities</h2>

      <ul
        v-if="capabilities.length > 0"
        class="mt-6 grid gap-px bg-outline-variant/20 border border-outline-variant/20"
      >
        <li
          v-for="capability in capabilities"
          :key="capability.to"
          class="bg-surface-container-low p-6"
        >
          <NuxtLink :to="capability.to" class="font-headline text-lg font-black uppercase">
            {{ capability.title }}
          </NuxtLink>
          <p class="mt-2 text-sm text-on-surface/70">{{ capability.description }}</p>
        </li>
      </ul>

      <p v-else class="mt-6 text-on-surface/70 leading-relaxed">
        None have been built yet. Importing a card, pricing its Multipliers, opening and locking
        Bouts, entering results and running Seasons each arrive with their own ticket, and each
        appears here.
      </p>
    </div>
  </section>
</template>
