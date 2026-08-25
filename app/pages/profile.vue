<script setup lang="ts">
import { EMAIL_MESSAGES } from "#shared/emails";

/**
 * What a fan sees of their own account.
 *
 * Balance, Entry history and leaderboard rank belong here and arrive with #17.
 * Today it is the identity page: it is what proves a session survives a reload
 * and reaches a server-rendered route, where a signed-out visitor is asked to
 * sign in, and where a fan whose verification email never arrived asks for
 * another one.
 */
const route = useRoute();
const { data: fan, refresh } = await useFan();
const { forget: forgetBalance } = useBalance();

useSeoMeta({
  title: "Your account",
  description: "Your TFC Predictions account.",
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
    <div class="max-w-xl mx-auto">
      <template v-if="fan">
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
