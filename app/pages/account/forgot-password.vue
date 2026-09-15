<script setup lang="ts">
import { EMAIL_MESSAGES } from "#shared/emails";

/**
 * Where a fan who cannot sign in asks for a way back in.
 *
 * The answer is the same sentence whether or not the address has an account,
 * because anyone can reach this page and it must never become a way of finding
 * out who has an account with TFC. The one thing it reports plainly is an
 * email that could not be sent, because a fan told to check an inbox that will
 * stay empty has no reason to try again.
 */
useSeoMeta({
  title: "Forgotten your password",
  description: "Ask TFC for a link that lets you set a new password.",
  robots: "noindex",
});

const email = ref("");
const problem = ref("");
const failure = ref("");
const asked = ref(false);
const submitting = ref(false);

async function submit() {
  submitting.value = true;
  problem.value = "";
  failure.value = "";

  try {
    await $fetch("/api/accounts/password-reset", { method: "POST", body: { email: email.value } });
    asked.value = true;
  } catch (error) {
    const reported = (error as { data?: { problems?: { message: string }[] } }).data?.problems;

    if (reported?.length) {
      problem.value = reported[0]?.message ?? EMAIL_MESSAGES.address;
    } else {
      failure.value = EMAIL_MESSAGES.notSent;
    }
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <PageHeading text="Forgotten your password" />

  <section class="px-6 md:px-20 pb-24">
    <div class="max-w-xl mx-auto">
      <template v-if="asked">
        <p class="text-on-surface/80 leading-relaxed">{{ EMAIL_MESSAGES.resetOnItsWay }}</p>

        <p class="mt-10 text-on-surface/70">
          <NuxtLink to="/account/sign-in" class="text-primary underline">
            Back to signing in
          </NuxtLink>
        </p>
      </template>

      <template v-else>
        <p class="text-on-surface/80 leading-relaxed mb-10">
          Give TFC the address you signed up with, and a link for setting a new password will be
          sent to it.
        </p>

        <form class="grid gap-8" novalidate @submit.prevent="submit">
          <AccountField
            v-model="email"
            name="email"
            label="Email address"
            type="email"
            autocomplete="email"
            :problem="problem"
          />

          <p v-if="failure" class="text-sm text-error" role="alert">{{ failure }}</p>

          <button
            type="submit"
            :disabled="submitting"
            class="bg-primary-container text-white font-headline font-black uppercase tracking-widest px-8 py-4 disabled:opacity-60"
          >
            {{ submitting ? "Sending the link…" : "Send me a link" }}
          </button>
        </form>

        <p class="mt-10 text-on-surface/70">
          Remembered it?
          <NuxtLink to="/account/sign-in" class="text-primary underline">Sign in</NuxtLink>.
        </p>
      </template>
    </div>
  </section>
</template>
