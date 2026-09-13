<script setup lang="ts">
import type { SignInPrompt } from "#shared/signIn";
import { SIGN_IN_MESSAGES } from "#shared/signIn";
import { accountPath, THE_CARD } from "~/utils/navigation";

/**
 * The card's standing invitation to whoever is reading it without an account.
 *
 * It sits above the card rather than under the Submit button, which is the
 * whole point: the requirement used to arrive as a refusal after a fan had
 * answered nine Bouts and chosen an Amount, and here it arrives as an
 * instruction before they answer the first. See `shared/signIn.ts` for what it
 * says and why it says it twice.
 *
 * **One element, two sentences.** The prompt changes in place the moment a
 * visitor answers something, rather than a second notice appearing beside the
 * first — and because it is a live region, that change is spoken as well as
 * shown. A fan who picked anyway is not being told off; they are being told
 * their answers are safe.
 *
 * Both ways to an account come back to the card, so taking the advice costs a
 * visitor nothing: signing in returns them to what they were reading, with the
 * answers they had given still on it (`useCardPicks`). The card is named here
 * rather than taken as a prop because there is one page a fan reads a card they
 * can answer on, and `EntryBuilder` and `FightCardBout` name it for the same
 * reason — a prop with one possible value is a prop that only looks general.
 *
 * Drawn as a rule down its own edge and nothing else, which is how every other
 * accent on this page is drawn (`CORNER_COLOURS`, and the Bout header's marks).
 * It goes from grey to the game's own colour once a visitor has answered
 * something: the same notice, turned up. And `role="status"` rather than an
 * `aside`'s complementary landmark, because claiming the landmark and then
 * overriding it with the live region only obscures which of the two this is.
 */
const props = defineProps<{ prompt: SignInPrompt }>();

/** Whether this is a visitor who has answered something, rather than one reading. */
const answered = computed(() => props.prompt.standing === "answered");
</script>

<template>
  <div
    role="status"
    class="border-l-4 bg-surface-container-low px-5 py-4 md:px-6 md:py-5"
    :class="answered ? 'border-primary' : 'border-outline-variant/50'"
  >
    <p class="font-headline text-base font-black italic uppercase md:text-lg">
      {{ prompt.headline }}
    </p>

    <p class="mt-2 max-w-3xl text-sm text-on-surface/75 leading-relaxed">{{ prompt.detail }}</p>

    <div class="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3">
      <NuxtLink
        :to="accountPath('sign-in', THE_CARD)"
        class="bg-primary-container px-6 py-3 font-headline text-sm font-black uppercase tracking-widest text-white transition-transform hover:scale-[1.02] active:scale-95"
      >
        {{ SIGN_IN_MESSAGES.signIn }}
      </NuxtLink>

      <NuxtLink
        :to="accountPath('sign-up', THE_CARD)"
        class="text-sm font-bold uppercase tracking-widest text-on-surface/70 underline hover:text-primary transition-colors"
      >
        {{ SIGN_IN_MESSAGES.createAccount }}
      </NuxtLink>
    </div>
  </div>
</template>
