<script setup lang="ts">
import {
  MINIMUM_AGE,
  MINIMUM_PASSWORD_LENGTH,
  USERNAME_LENGTH,
  contestDateOn,
  type SignUpField,
} from "#shared/signUp";

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
  description: "Join TFC Predictions and answer three Questions about every Bout on the card.",
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
  firstName: "",
  lastName: "",
  dateOfBirth: "",
});

interface AccountFormField {
  name: SignUpField;
  label: string;
  type: string;
  autocomplete: string;
  hint: string;
  /** The latest date the picker will offer, where that makes sense. */
  max?: string;
}

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
    hint: "TFC sends a link here to confirm your account.",
  },
  {
    name: "password",
    label: "Password",
    type: "password",
    autocomplete: "new-password",
    hint: `At least ${MINIMUM_PASSWORD_LENGTH} characters.`,
  },
  {
    name: "firstName",
    label: "First name",
    type: "text",
    autocomplete: "given-name",
    hint: "Kept private. Used only to send you a Prize.",
  },
  {
    name: "lastName",
    label: "Last name",
    type: "text",
    autocomplete: "family-name",
    hint: "Kept private, for the same reason.",
  },
  {
    name: "dateOfBirth",
    label: "Date of birth",
    type: "date",
    autocomplete: "bday",
    // The server decides eligibility; this only stops the date picker
    // offering days that have not happened.
    max: contestDateOn(new Date()),
    hint: `TFC Predictions is for fans aged ${MINIMUM_AGE} and over.`,
  },
];

async function submit() {
  submitting.value = true;
  problems.value = {};
  failure.value = "";

  try {
    await $fetch("/api/accounts/sign-up", { method: "POST", body: { ...form } });
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
        Your username is the only thing other fans ever see. Your name and date of birth stay
        private — TFC holds them to confirm you can take part, and to send a Prize to a winner.
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
          :max="field.max"
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

      <p class="mt-4 text-on-surface/70">
        <NuxtLink to="/contest-rules" class="text-primary underline">The contest rules</NuxtLink>
        say who can take part.
      </p>
    </div>
  </section>
</template>
