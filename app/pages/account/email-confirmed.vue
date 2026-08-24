<script setup lang="ts">
import { EMAIL_MESSAGES } from "#shared/emails";

/**
 * Where the link in a verification email lands.
 *
 * The confirming itself has already happened by the time this renders:
 * `better-auth` marks the address on its own route and redirects here, with
 * the reason in the query when it would not. So this page reports, it does not
 * act — which is what lets the same link work in a browser the fan is not
 * signed in on.
 */
useSeoMeta({
  title: "Email confirmed",
  description: "Confirming your TFC Predictions email address.",
  robots: "noindex",
});

const route = useRoute();
const { data: fan } = await useFan();

// `INVALID_TOKEN`, `TOKEN_EXPIRED`, `USER_NOT_FOUND` — three ways of saying
// the one thing the fan can do something about.
const refused = computed(() => Boolean(route.query.error));

// Asking for another link is a thing a signed-in fan does from their account,
// where the button lives. This one goes there; it does not pretend to send.
const onwards = computed(() => (fan.value ? "/profile" : "/account/sign-in"));
const onwardsLabel = computed(() => (fan.value ? "Your account" : "Sign in"));
</script>

<template>
  <PageHeading :text="refused ? 'That link did not work' : 'Email confirmed'" />

  <section class="px-6 md:px-20 pb-24">
    <div class="max-w-xl mx-auto">
      <p class="text-on-surface/80 leading-relaxed">
        <template v-if="refused">{{ EMAIL_MESSAGES.linkExpired }}</template>
        <template v-else>
          {{ EMAIL_MESSAGES.confirmed }} You can take part in TFC Predictions.
        </template>
      </p>

      <div class="mt-8 flex flex-wrap gap-4">
        <NuxtLink
          :to="onwards"
          class="bg-primary-container text-white font-headline font-black uppercase tracking-widest px-8 py-4"
        >
          {{ onwardsLabel }}
        </NuxtLink>
      </div>
    </div>
  </section>
</template>
