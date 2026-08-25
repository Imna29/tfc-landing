<script setup lang="ts">
import { EMAIL_MESSAGES } from "#shared/emails";

/**
 * The sign-in form.
 *
 * A failure says one thing however it failed: naming which half was wrong
 * would tell anyone who asked which email addresses have accounts.
 */
useSeoMeta({
  title: "Sign in",
  description: "Sign in to TFC Predictions.",
  robots: "noindex",
});

// A fan who is already signed in has nothing to do here.
const { data: signedIn } = await useFan();

if (signedIn.value) {
  await navigateTo("/profile");
}

// Setting a new password signs every session out, so a fan arrives here from
// the reset form rather than at their account, and deserves to be told why.
const route = useRoute();
const justResetPassword = computed(() => route.query.reset === "done");

// The header is mounted once and outlives every page, so it only learns a fan
// has Coins because somewhere says so. See `app/composables/useBalance.ts`.
const { refresh: refreshBalance } = useBalance();

const form = reactive({ email: "", password: "" });
const failure = ref("");
const submitting = ref(false);

async function submit() {
  submitting.value = true;
  failure.value = "";

  try {
    await $fetch("/api/auth/sign-in/email", { method: "POST", body: { ...form } });
    await refreshBalance();
    await navigateTo("/profile");
  } catch {
    failure.value = "Those details do not match an account.";
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <PageHeading text="Sign in" />

  <section class="px-6 md:px-20 pb-24">
    <div class="max-w-xl mx-auto">
      <p v-if="justResetPassword" class="text-on-surface/80 leading-relaxed mb-10" role="status">
        {{ EMAIL_MESSAGES.passwordChanged }}
      </p>

      <form class="grid gap-8" novalidate @submit.prevent="submit">
        <AccountField
          v-model="form.email"
          name="email"
          label="Email address"
          type="email"
          autocomplete="email"
        />

        <AccountField
          v-model="form.password"
          name="password"
          label="Password"
          type="password"
          autocomplete="current-password"
        />

        <p v-if="failure" class="text-sm text-error" role="alert">{{ failure }}</p>

        <button
          type="submit"
          :disabled="submitting"
          class="bg-primary-container text-white font-headline font-black uppercase tracking-widest px-8 py-4 disabled:opacity-60"
        >
          {{ submitting ? "Signing you in…" : "Sign in" }}
        </button>
      </form>

      <p class="mt-10 text-on-surface/70">
        <NuxtLink to="/account/forgot-password" class="text-primary underline">
          Forgotten your password?
        </NuxtLink>
      </p>

      <p class="mt-4 text-on-surface/70">
        New here?
        <NuxtLink to="/account/sign-up" class="text-primary underline">Create an account</NuxtLink>.
      </p>
    </div>
  </section>
</template>
