<script setup lang="ts">
import { EMAIL_MESSAGES } from "#shared/emails";
import { SIGN_UP_MESSAGES } from "#shared/signUp";

/**
 * Where a fan sets the new password their emailed link entitles them to.
 *
 * The link carries a token that `better-auth` consumes when the password is
 * set: one link, one password, and an hour to use it. Nothing is validated
 * here that the server also validates — the same rule the sign-up form
 * follows — so what this page does with a refusal is translate it.
 */
useSeoMeta({
  title: "Set a new password",
  description: "Set a new password for your TFC Predictions account.",
  robots: "noindex",
});

const route = useRoute();

// `better-auth` redirects here with a token when the link is good, and with an
// `error` when it is not. A page reached with neither was not reached from an
// email at all.
const token = computed(() => (typeof route.query.token === "string" ? route.query.token : ""));
const usable = computed(() => token.value !== "" && !route.query.error);

const password = ref("");
const problem = ref("");
const failure = ref("");
const submitting = ref(false);

async function submit() {
  submitting.value = true;
  problem.value = "";
  failure.value = "";

  try {
    await $fetch("/api/auth/reset-password", {
      method: "POST",
      body: { newPassword: password.value, token: token.value },
    });

    // Setting a password signs every session out, this one included, so the
    // only place to go from here is the sign-in form.
    await navigateTo("/account/sign-in?reset=done");
  } catch (error) {
    const code = (error as { data?: { code?: string } }).data?.code;

    if (code === "PASSWORD_TOO_SHORT" || code === "PASSWORD_TOO_LONG") {
      problem.value = SIGN_UP_MESSAGES.password;
    } else if (code === "INVALID_TOKEN" || code === "USER_NOT_FOUND") {
      failure.value = EMAIL_MESSAGES.linkExpired;
    } else {
      failure.value = "Something went wrong on our side. Try again in a moment.";
    }
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <PageHeading text="Set a new password" />

  <section class="px-6 md:px-20 pb-24">
    <div class="max-w-xl mx-auto">
      <template v-if="usable">
        <form class="grid gap-8" novalidate @submit.prevent="submit">
          <AccountField
            v-model="password"
            name="password"
            label="New password"
            type="password"
            autocomplete="new-password"
            :hint="SIGN_UP_MESSAGES.password"
            :problem="problem"
          />

          <p v-if="failure" class="text-sm text-error" role="alert">{{ failure }}</p>

          <button
            type="submit"
            :disabled="submitting"
            class="bg-primary-container text-white font-headline font-black uppercase tracking-widest px-8 py-4 disabled:opacity-60"
          >
            {{ submitting ? "Setting your password…" : "Set my password" }}
          </button>
        </form>
      </template>

      <template v-else>
        <p class="text-on-surface/80 leading-relaxed">{{ EMAIL_MESSAGES.linkExpired }}</p>

        <div class="mt-8 flex flex-wrap gap-4">
          <NuxtLink
            to="/account/forgot-password"
            class="bg-primary-container text-white font-headline font-black uppercase tracking-widest px-8 py-4"
          >
            Send me a new link
          </NuxtLink>
        </div>
      </template>
    </div>
  </section>
</template>
