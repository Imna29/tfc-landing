<script setup lang="ts">
import { EMAIL_MESSAGES } from "#shared/emails";
import type { FanHistory } from "#shared/history";
// Aliased because `FanStanding` is also the component that renders one, and
// this file uses both: the auto-imported component in the template, and the
// shape it takes here.
import type { FanStanding as Standing } from "#shared/standings";

/**
 * What a fan sees of their own: where they stand, everything they have ever
 * predicted, and the account underneath it.
 *
 * Three answers rather than one, because they change at different moments and
 * cost different things. The account is `useFan`, shared with every page that
 * asks who is signed in; the standing is one Balance and one Rank; the history
 * is re-read every time the fan moves a filter, and re-reading their Rank
 * alongside it would be asking the Season to be ordered again to answer a
 * question nobody asked.
 *
 * **The filter lives in the URL.** A fan who reloads, or presses back, is
 * looking at the same page they left, and the server renders the filtered
 * history rather than sending all of it for the browser to hide most of. That
 * matters more every Season: history is kept forever.
 *
 * Never edge-cached and server-rendered per request (ADR-0008). It is the most
 * personal page in the application — and `/PROFILE` is a 404 rather than a
 * second spelling that could miss that rule (ADR-0012).
 */
const route = useRoute();
const { data: fan, refresh } = await useFan();
const { forget: forgetBalance } = useBalance();

/**
 * Through `useRequestFetch` for the reason `useFan` uses it: these run during
 * server rendering too, and a plain `$fetch` there carries no cookie — both
 * routes would answer 401 and the page would fail to render for exactly the
 * fans it is for.
 */
const request = useRequestFetch();

const { data: standing } = await useAsyncData<Standing | null>(
  "fan-standing",
  async () => (fan.value ? await request<Standing>("/api/coins/standing") : null),
  { watch: [fan] },
);

/** What the fan is asking to see, as the two controls put it in the URL. */
const asked = computed(() => ({
  season: typeof route.query.season === "string" ? route.query.season : undefined,
  status: typeof route.query.status === "string" ? route.query.status : undefined,
}));

const { data: history } = await useAsyncData<FanHistory | null>(
  "entry-history",
  async () =>
    fan.value
      ? await request<FanHistory>("/api/predictions/history", { query: asked.value })
      : null,
  { watch: [fan, asked] },
);

/**
 * Moves the filter, which is a navigation.
 *
 * The rest of the query string is kept: a fan who arrived from sign-up is
 * being told their confirmation email did not go out, and filtering their
 * history is not news about that.
 */
function ask(filter: { season: string; status: string }) {
  return navigateTo({
    query: {
      ...route.query,
      // Dropped rather than sent empty, so that the whole history — which is
      // where the page starts — is the plain URL a fan arrives at rather than
      // one spelling "every" out in two parameters.
      season: filter.season === "" ? undefined : filter.season,
      status: filter.status === "" ? undefined : filter.status,
    },
  });
}

useSeoMeta({
  title: "Your account",
  description: "Your TFC Predictions Balance, Rank and Entry history.",
  robots: "noindex",
});

const signingOut = ref(false);
const sendingAgain = ref(false);
const askedAgain = ref(false);
const sendingFailed = ref(false);

// Sign-up says so when the first email did not go out, so that a fan is not
// left waiting for one. See `server/api/accounts/sign-up.post.ts`.
const unsentAtSignUp = computed(() => route.query.verification === "unsent");

/** What to say about the email, if anything, under the confirmation state. */
const notice = computed(() => {
  if (sendingFailed.value) return EMAIL_MESSAGES.notSent;
  if (askedAgain.value) return EMAIL_MESSAGES.confirmationOnItsWay;
  if (unsentAtSignUp.value) return EMAIL_MESSAGES.notSent;

  return "";
});

async function sendVerificationAgain() {
  sendingAgain.value = true;
  askedAgain.value = false;
  sendingFailed.value = false;

  try {
    // The address may have been confirmed on another device since this page
    // rendered, in which case nothing was sent and there is nothing to promise
    // — refreshing the fan takes the whole question off the page instead.
    const { sent } = await $fetch("/api/accounts/verification-email", { method: "POST" });

    askedAgain.value = sent;
    await refresh();
  } catch {
    sendingFailed.value = true;
  } finally {
    sendingAgain.value = false;
  }
}

async function signOut() {
  signingOut.value = true;

  try {
    // The empty body is not spare: `better-auth` refuses a request with no
    // `content-type`, and ofetch only sets one when it has something to
    // serialise. Sign-out is the only call here with nothing to send.
    await $fetch("/api/auth/sign-out", { method: "POST", body: {} });
    forgetBalance();
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

        <EntryHistory v-if="history" :history="history" class="mb-16" @ask="ask" />

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
            <dd class="mt-2 text-sm text-on-surface/70">
              {{
                fan.emailVerified
                  ? "Confirmed."
                  : "Not confirmed yet. Confirm it before you submit your first Entry."
              }}
            </dd>
            <dd v-if="!fan.emailVerified" class="mt-4">
              <button
                type="button"
                :disabled="sendingAgain"
                class="border border-outline-variant/40 font-headline text-sm font-black uppercase tracking-widest px-6 py-3 disabled:opacity-60"
                @click="sendVerificationAgain"
              >
                {{ sendingAgain ? "Sending…" : "Send the link again" }}
              </button>

              <p
                v-if="notice"
                class="mt-3 text-sm"
                :class="sendingFailed || unsentAtSignUp ? 'text-error' : 'text-on-surface/70'"
                role="status"
              >
                {{ notice }}
              </p>
            </dd>
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
