<script setup lang="ts">
// Aliased because `FanStanding` is also the component that renders one, and
// this file uses both: the auto-imported component in the template, and the
// shape it takes here.
import type { FanStanding as Standing } from "#shared/standings";
import { MY_PREDICTIONS } from "~/utils/navigation";

/**
 * What a fan sees of their own: where they stand, and the account underneath
 * it.
 *
 * Two answers rather than one, because they change at different moments and
 * cost different things. The account is `useFan`, shared with every page that
 * asks who is signed in; the standing is one Balance and one Rank.
 *
 * **Everything a fan has predicted is no longer here.** It is My Predictions,
 * at {@link MY_PREDICTIONS}, and this page links to it: a fan checking whether
 * their chain survived Bout 3 is playing the game rather than administering an
 * account, and the listing belongs in the section the card is in. Drawing it in
 * both places would be one Entry on two pages that could come to disagree, so
 * this page names where it went instead.
 *
 * Never edge-cached and server-rendered per request (ADR-0008). It is one of
 * the most personal pages in the application — and `/PROFILE` is a 404 rather
 * than a second spelling that could miss that rule (ADR-0012).
 */
const { data: fan, refresh } = await useFan();
const { forget: forgetBalance } = useBalance();
// And the answers half-built on the card, which are this fan's and not the next
// person's to find on the same browser. See `app/composables/useCardPicks.ts`.
const { forget: forgetPicks } = useCardPicks();

/**
 * Through `useRequestFetch` for the reason `useFan` uses it: this runs during
 * server rendering too, and a plain `$fetch` there carries no cookie — the
 * route would answer 401 and the page would fail to render for exactly the
 * fans it is for.
 */
const request = useRequestFetch();

const { data: standing } = await useAsyncData<Standing | null>(
  "fan-standing",
  async () => (fan.value ? await request<Standing>("/api/coins/standing") : null),
  { watch: [fan] },
);

useSeoMeta({
  title: "Your account",
  description: "Your TFC Predictions Balance and Rank, and the account behind them.",
  robots: "noindex",
});

const signingOut = ref(false);

async function signOut() {
  signingOut.value = true;

  try {
    // The empty body is not spare: `better-auth` refuses a request with no
    // `content-type`, and ofetch only sets one when it has something to
    // serialise. Sign-out is the only call here with nothing to send.
    await $fetch("/api/auth/sign-out", { method: "POST", body: {} });
    forgetBalance();
    forgetPicks();
    await refresh();
    await navigateTo("/account/sign-in");
  } finally {
    signingOut.value = false;
  }
}
</script>

<template>
  <PageHeading text="Your account" />

  <section class="px-6 md:px-20 pb-24">
    <div class="max-w-3xl mx-auto">
      <template v-if="fan">
        <FanStanding :standing="standing ?? null" class="mb-10" />

        <!--
          Where everything this fan has predicted went. A link rather than the
          listing, so that one page owns a fan's Entries — and it is worth a
          block of its own rather than a line in the footer, because it is the
          thing a fan came to the profile for before it moved.
        -->
        <NuxtLink
          :to="MY_PREDICTIONS"
          class="mb-16 flex flex-wrap items-baseline justify-between gap-3 border border-outline-variant/20 bg-surface-container-low p-8 hover:border-primary transition-colors"
        >
          <span>
            <span class="font-headline text-xl font-black italic uppercase">My Predictions</span>
            <span class="mt-2 block max-w-md text-sm text-on-surface/70 leading-relaxed">
              Every Entry you have committed — what you are still riding on, and everything that is
              done with, kept through every Season.
            </span>
          </span>
          <span class="font-headline text-xs font-black uppercase tracking-widest text-primary">
            Read them
          </span>
        </NuxtLink>

        <dl class="grid gap-px bg-outline-variant/20 border border-outline-variant/20">
          <div class="bg-surface-container-low p-8">
            <dt
              class="font-headline text-sm font-black uppercase tracking-widest text-on-surface/60"
            >
              Username
            </dt>
            <dd class="font-headline text-3xl font-black italic uppercase mt-2">
              {{ fan.username }}
            </dd>
          </div>

          <div class="bg-surface-container-low p-8">
            <dt
              class="font-headline text-sm font-black uppercase tracking-widest text-on-surface/60"
            >
              Email address
            </dt>
            <dd class="mt-2">{{ fan.email }}</dd>
          </div>
        </dl>

        <button
          type="button"
          :disabled="signingOut"
          class="mt-10 border border-outline-variant/40 font-headline font-black uppercase tracking-widest px-8 py-4 disabled:opacity-60"
          @click="signOut"
        >
          {{ signingOut ? "Signing you out…" : "Sign out" }}
        </button>
      </template>

      <template v-else>
        <p class="text-on-surface/80 leading-relaxed">Sign in to see your account.</p>

        <div class="mt-8 flex flex-wrap gap-4">
          <NuxtLink
            to="/account/sign-in"
            class="bg-primary-container text-white font-headline font-black uppercase tracking-widest px-8 py-4"
          >
            Sign in
          </NuxtLink>
          <NuxtLink
            to="/account/sign-up"
            class="border border-outline-variant/40 font-headline font-black uppercase tracking-widest px-8 py-4"
          >
            Create an account
          </NuxtLink>
        </div>
      </template>
    </div>
  </section>
</template>
