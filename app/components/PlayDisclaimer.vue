<script setup lang="ts">
import { disclaimerSeen, PLAY_DISCLAIMER, rememberDisclaimerSeen } from "~/utils/disclaimer";

/**
 * The PlayTFC disclaimer, shown once to a browser that has not dismissed it.
 *
 * Mounted by `app/layouts/play.vue`, so it is shown on whichever page of the
 * section a fan reaches first — the card, the leaderboard, or a sign-in form a
 * link sent them to — rather than only on the card.
 *
 * A native `<dialog>` opened with `showModal()`, which provides what a popup
 * needs: the page behind it can't be clicked or tabbed to, focus moves into it,
 * and Escape closes it. The dialog is in the server-rendered HTML but closed,
 * since the server can't know what this browser remembers. It is opened after
 * mount.
 *
 * Every way of closing it counts as dismissing it: the button, the ×, Escape,
 * or a tap outside. They all fire `close`, which is where it is remembered.
 * Leaving the section while it is open fires nothing, so a fan who never
 * dismissed it is shown it again.
 */
const dialog = useTemplateRef<HTMLDialogElement>("dialog");

/**
 * Dismissed in this visit. Redundant while storage works; when the browser
 * refuses it, this stops the popup reappearing every time a fan comes back to
 * the section from the marketing site without reloading.
 */
const dismissed = useState("play-disclaimer-dismissed", () => false);

onMounted(() => {
  if (dismissed.value || disclaimerSeen()) return;

  dialog.value?.showModal();
  // `showModal` focuses the × as the first control, which shows a focus ring
  // nobody asked for. Focusing the dialog instead means a screen reader starts
  // at the title. Chrome does not yet honour `autofocus` on the dialog itself.
  dialog.value?.focus();
});

function dismiss() {
  dialog.value?.close();
}

function remember() {
  dismissed.value = true;
  rememberDisclaimerSeen();
}
</script>

<template>
  <!--
    `open:flex`, never a bare `flex`: a display class on a closed dialog beats
    the browser's `display: none` and shows it. `m-auto` puts back the centring
    Tailwind's reset takes off. The dialog has no padding of its own, so a click
    whose target is the dialog itself can only be a click on the backdrop.
    `tabindex="-1"` lets the dialog itself take focus when it opens (see
    `onMounted`).
  -->
  <dialog
    ref="dialog"
    tabindex="-1"
    aria-labelledby="play-disclaimer-title"
    class="m-auto w-[calc(100%-2rem)] max-w-xl max-h-[calc(100dvh-2rem)] flex-col bg-surface-container text-on-surface border border-outline-variant/30 brutalist-shadow outline-none open:flex backdrop:bg-black/80 backdrop:backdrop-blur-sm"
    @click.self="dismiss"
    @close="remember"
  >
    <div
      class="flex items-center justify-between gap-4 border-b border-outline-variant/15 py-3 pl-5 pr-2 sm:pl-8 sm:pr-4"
    >
      <div class="flex items-center gap-3">
        <TfcCoin class="w-6 h-6 shrink-0" />
        <h2
          id="play-disclaimer-title"
          class="font-headline text-lg sm:text-xl font-black italic uppercase tracking-tight"
        >
          Before you play
        </h2>
      </div>

      <button
        type="button"
        class="w-11 h-11 shrink-0 flex items-center justify-center text-on-surface/70 hover:text-primary transition-colors"
        aria-label="Close"
        @click="dismiss"
      >
        <Icon name="material-symbols:close" class="text-2xl" />
      </button>
    </div>

    <!-- The only part that scrolls, so the way out stays on screen on a phone. -->
    <div class="min-h-0 overflow-y-auto overscroll-contain px-5 py-5 sm:px-8 sm:py-6 space-y-6">
      <section
        v-for="language in PLAY_DISCLAIMER"
        :key="language.lang"
        :lang="language.lang"
        class="space-y-3"
      >
        <!-- Not `uppercase`: that turns Georgian into Mtavruli, which reads as shouting. -->
        <h3 class="font-headline text-sm font-bold text-primary">{{ language.label }}</h3>
        <p
          v-for="(paragraph, index) in language.paragraphs"
          :key="index"
          class="text-sm leading-relaxed text-on-surface/85"
        >
          {{ paragraph }}
        </p>
      </section>
    </div>

    <div class="border-t border-outline-variant/15 px-5 py-4 sm:px-8 flex sm:justify-end">
      <button
        type="button"
        class="w-full sm:w-auto bg-primary-container text-white font-headline font-black uppercase tracking-widest px-8 py-3 hover:bg-on-primary-fixed-variant transition-colors"
        @click="dismiss"
      >
        I understand
      </button>
    </div>
  </dialog>
</template>
