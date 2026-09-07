<script setup lang="ts">
import { MINIMUM_PASSWORD_LENGTH, USERNAME_LENGTH, type SignUpField } from "#shared/signUp";

/**
 * The sign-up form.
 *
 * The server decides what is acceptable and answers with one sentence per
 * field that needs changing; this shows them where they belong and leaves the
 * fan's answers in place. Nothing is validated twice here — a second opinion
 * that disagreed with the server's would be worse than none.
 */
useSeoMeta({
  title: "Create an account",
  description: "Join TFC Predictions and answer two Questions about every Bout on the card.",
  robots: "noindex",
});

// A fan who is already signed in has nothing to do here.
const { data: signedIn } = await useFan();

if (signedIn.value) {
  await navigateTo("/profile");
}

const form = reactive({
  username: "",
  email: "",
  password: "",
  phone: "",
});

interface AccountFormField {
  name: SignUpField;
  label: string;
  type: string;
  autocomplete: string;
  hint: string;
}

// Signing up signs the fan in and grants them the Season's Coins, so the
// header has something to say from the moment they land on their profile.
const { refresh: refreshBalance } = useBalance();

const problems = ref<Partial<Record<SignUpField, string>>>({});
const failure = ref("");
const submitting = ref(false);

const fields: AccountFormField[] = [
  {
    name: "username",
    label: "Username",
    type: "text",
    autocomplete: "username",
    hint: `${USERNAME_LENGTH.minimum} to ${USERNAME_LENGTH.maximum} characters. This is the only name other fans see.`,
  },
  {
    name: "email",
    label: "Email address",
    type: "email",
    autocomplete: "email",
    hint:
      "How TFC reaches you about your account, and how you get back in if you " +
      "forget your password.",
  },
  {
    name: "password",
    label: "Password",
    type: "password",
    autocomplete: "new-password",
    hint: `At least ${MINIMUM_PASSWORD_LENGTH} characters.`,
  },
  {
    name: "phone",
    label: "Phone number",
    type: "tel",
    autocomplete: "tel",
    hint:
      "Starting with its country code, like +995 555 12 34 56. Kept private — other " +
      "fans never see it, and TFC Predictions is played on one account per number.",
  },
];

async function submit() {
  submitting.value = true;
  problems.value = {};
  failure.value = "";

  try {
    await $fetch("/api/accounts/sign-up", { method: "POST", body: { ...form } });

    await refreshBalance();

    // Straight to the profile: signing up signs the fan in and there is no
    // second step to wait on (ADR-0018).
    await navigateTo("/profile");
  } catch (error) {
    const reported = (error as { data?: { problems?: { field: SignUpField; message: string }[] } })
      .data?.problems;

    if (reported?.length) {
      problems.value = Object.fromEntries(reported.map((p) => [p.field, p.message]));
    } else {
      failure.value = "Something went wrong on our side. Try again in a moment.";
    }
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <PageHeading text="Create an account" />

  <section class="px-6 md:px-20 pb-24">
    <div class="max-w-xl mx-auto">
      <p class="text-on-surface/80 leading-relaxed mb-10">
        Your username is the only thing other fans ever see. Your email address and phone number
        stay private — TFC holds them to reach you about your account, and plays TFC Predictions on
        one account per person.
      </p>

      <form class="grid gap-8" novalidate @submit.prevent="submit">
        <AccountField
          v-for="field in fields"
          :key="field.name"
          v-model="form[field.name]"
          :name="field.name"
          :label="field.label"
          :type="field.type"
          :autocomplete="field.autocomplete"
          :hint="field.hint"
          :problem="problems[field.name]"
        />

        <p v-if="failure" class="text-sm text-error" role="alert">{{ failure }}</p>

        <button
          type="submit"
          :disabled="submitting"
          class="bg-primary-container text-white font-headline font-black uppercase tracking-widest px-8 py-4 disabled:opacity-60"
        >
          {{ submitting ? "Creating your account…" : "Create account" }}
        </button>
      </form>

      <p class="mt-10 text-on-surface/70">
        Already have an account?
        <NuxtLink to="/account/sign-in" class="text-primary underline">Sign in</NuxtLink>.
      </p>
    </div>
  </section>
</template>
