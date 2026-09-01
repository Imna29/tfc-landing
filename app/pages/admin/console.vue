<script setup lang="ts">
import {
  CONSOLE_MESSAGES,
  hasStarted,
  nextToLock,
  type ConsoleBout,
  type LockConsole,
} from "#shared/console";
import { boutState, BOUT_STATE_LABELS } from "#shared/predictions";

/**
 * The live lock console: the card being fought, and one control to close the
 * next Bout on it.
 *
 * The one screen in the admin area with a design pass, and ADR-0011 says why
 * it is the one: everything else is a form somebody sits down in front of
 * before a card, and this is used cageside, one-handed, in the dark, by an
 * admin who is also watching the fights. ADR-0006 is what puts them there —
 * Bouts lock one at a time as the card progresses, so a human advances the
 * Lock down it all evening — and the backstops behind that person already work
 * without this page. What this makes is the difference between locking a Bout
 * being possible and being quick.
 *
 * Four decisions shape it, and all four are about a thumb in a dark arena:
 *
 * - **One control, and it names one Bout.** `nextToLock` decides which, and it
 *   is never a choice: the open Bout fought first. A screen of buttons, one
 *   per fight, is a screen where the wrong one gets pressed.
 * - **The control is at the bottom**, where a thumb reaches on a phone held in
 *   one hand, and it is the height of a thumb. The card scrolls above it.
 * - **It rests after every press.** The control moves to the next fight the
 *   moment a Lock lands, so an accidental double-tap would otherwise close two
 *   Bouts — the second of them a fight nobody has finished. So a press leaves
 *   a statement where the button was, and no button at all, for
 *   {@link RESTS_FOR}. A refused press rests too: the refusals this meets are
 *   all the card having moved underneath it, which moves the control just the
 *   same. The server refuses a second press on the *same* Bout on its own
 *   (`LOCK_MESSAGES.alreadyLocked`); this is what stops a second press reaching
 *   the *next* one.
 * - **Before the card has started, it asks twice.** `hasStarted` is what arms
 *   it: during the evening this screen is for, closing the Bout being fought is
 *   one press, and an early Lock — a card running ahead of schedule, a fighter
 *   withdrawing — is a decision rather than a reflex. A Lock is never taken
 *   back, and this is the one screen built to be pressed without looking.
 *
 * It re-reads itself on a timer as well as after a press, because an admin is
 * not the only thing that locks Bouts: the backstops fall due while nobody is
 * looking, and a second admin may be locking from a second phone. A console
 * showing a Bout as open that closed four minutes ago is a console somebody
 * presses.
 *
 * Nothing here is what keeps a fan out: `server/middleware/admin.ts` refuses
 * the request before this page is rendered at all.
 */
definePageMeta({
  // No site header, no footer, no navigation. This is a phone screen used
  // between two fights: the chrome would take a third of it, and the footer
  // costs a Prismic round trip an arena connection may not have.
  layout: false,
});

useSeoMeta({
  title: "Live lock console",
  description: "Locking Bouts as a TFC card is fought.",
  robots: "noindex",
});

/**
 * How long the control rests after a press, how long an early Lock stays asked
 * for, and how often the card is re-read.
 *
 * The rest is long enough to outlast a double-tap and short enough that an
 * admin closing two fights in quick succession does not wait on it. The ask
 * outlives a moment of hesitation and then forgets, so a control left armed in
 * a pocket does not stay armed. The re-read is what catches a Lock this phone
 * did not perform; it is deliberately not a second, because the console is one
 * admin's screen for a whole evening and a request a second costs a serverless
 * function far more than it buys them.
 */
const RESTS_FOR = 4000;
const ASKS_FOR = 8000;
const REREADS_EVERY = 15_000;

const request = useRequestFetch();

const { data, error, refresh } = await useAsyncData("admin-console", () =>
  request<{ card: LockConsole | null }>("/api/admin/console"),
);

// For the reason `app/pages/admin/index.vue` throws: on a client-side
// navigation nothing has asked the server anything, and rendering the console
// for somebody who cannot use it would look like it had worked.
if (!data.value) throw noAnswerFrom(error.value);

const card = computed(() => data.value?.card ?? null);

// Starts where the server left off and ticks from the browser's clock once
// mounted, so the countdown does not disagree with the HTML it is hydrating.
const now = useNow(card.value?.answeredAt);

const working = ref(false);
const problem = ref("");

/** What the last press did, and when — the statement the control rests as. */
const pressed = ref<{ said: string; at: number } | null>(null);

/** Whether the control is resting, so a second tap lands on nothing. */
const resting = computed(() => pressed.value !== null && now.value - pressed.value.at < RESTS_FOR);

/** The Bout to lock next, which is the only fight this screen offers. */
const next = computed(() => (card.value ? nextToLock(card.value.bouts, now.value) : null));

/** Whether the card is under way, which is what arms the control. */
const started = computed(() => card.value !== null && hasStarted(card.value, now.value));

/** An early Lock this admin has asked for and not yet confirmed. */
const asked = ref<{ boutId: string; at: number } | null>(null);

/**
 * Whether the control is holding an early Lock, waiting to be pressed again.
 *
 * Held against the Bout it was asked about, so a confirmation cannot land on
 * another fight: the card can move between the two presses, and the second one
 * is then a first press about whatever the control is now offering.
 */
const asking = computed(
  () =>
    asked.value !== null &&
    asked.value.boutId === next.value?.id &&
    now.value - asked.value.at < ASKS_FOR,
);

/** Where a Bout has got to, worked out rather than read off the column. */
function stateOf(bout: ConsoleBout) {
  return boutState(bout, now.value);
}

/** Whether this is the fight the control at the bottom is about. */
function isNext(bout: ConsoleBout): boolean {
  return next.value?.id === bout.id;
}

/**
 * How a Bout came to be locked, in the line `/admin/events/[id]` reads it in —
 * and, for a Lock that has fallen due with nothing to show for it yet, the line
 * the next read will write.
 *
 * The backstops fall due while nobody is looking, and the row is written by
 * whichever request arrives next; between those two the state on this screen
 * has moved and the log has not. Saying nothing for those seconds would be a
 * Bout that says it has locked and will not say why, at first bell, which is
 * the moment an admin is watching this screen hardest. What it says instead is
 * what the Lock is going to be, worked out from the same two answers the server
 * writes it from.
 */
function lockOf(bout: ConsoleBout): string | null {
  if (bout.lock) return lockLine(bout.lock);
  if (bout.status !== "open" || stateOf(bout) !== "locked") return null;

  return lockLine({ kind: bout.locksAs, at: bout.locksAt, by: null });
}

/** How long until the backstop closes everything still open on this card. */
const sweepIn = computed(() => {
  if (!card.value) return null;

  const remaining = remainingUntil(card.value.sweepAt, now.value);

  return remaining && remainingLabel(remaining);
});

/** Why there is no control, when there is a card but nothing to lock on it. */
const nothingToLock = computed(() => {
  if (!card.value || next.value) return null;

  const allOpened = card.value.bouts.every((bout) => stateOf(bout) !== "closed");

  return allOpened ? CONSOLE_MESSAGES.everythingLocked : CONSOLE_MESSAGES.nothingOpen;
});

/**
 * What the one control says: the Lock it is about, the ask before a card has
 * started, the confirmation of that ask, and the press it is in the middle of.
 */
const pressLabel = computed(() => {
  const bout = next.value;

  if (!bout) return null;
  if (working.value) return CONSOLE_MESSAGES.locking;
  if (started.value) return CONSOLE_MESSAGES.lock(bout.cardOrder);

  return asking.value
    ? CONSOLE_MESSAGES.confirmEarly(bout.cardOrder)
    : CONSOLE_MESSAGES.lockEarly(bout.cardOrder);
});

/**
 * The one control, pressed.
 *
 * On a card under way that is the Lock itself. On one that has not started it
 * is the ask, and the Lock is the press after it — see `hasStarted`.
 */
function press() {
  if (!next.value || working.value || resting.value) return;

  if (!started.value && !asking.value) {
    asked.value = { boutId: next.value.id, at: Date.now() };

    return;
  }

  return lockNext();
}

/**
 * Locks the Bout the control names.
 *
 * The Bout is named by id, which is what makes this safe to press twice: the
 * second press asks about the same Bout and is told it has locked, rather than
 * closing the next fight on the card.
 */
async function lockNext() {
  const bout = next.value;

  if (!bout) return;

  working.value = true;
  problem.value = "";
  asked.value = null;

  try {
    await $fetch(`/api/admin/bouts/${bout.id}/lock`, { method: "POST" });

    pressed.value = { said: CONSOLE_MESSAGES.locked(bout.cardOrder), at: Date.now() };
  } catch (failure) {
    problem.value = problemFrom(failure);

    // Every refusal this can meet is the card having moved underneath the
    // press: another admin locked that Bout, or a backstop did. The control is
    // about to be about a different fight, so it rests exactly as it would
    // have on a Lock — a refusal is the one moment a second tap is most likely
    // and would land on a fight nobody has finished.
    pressed.value = { said: CONSOLE_MESSAGES.moved, at: Date.now() };
  } finally {
    working.value = false;

    // Either way the card has moved: it locked, or it turned out to have
    // locked already. Read it back before the screen offers anything else.
    await refresh();
  }
}

/**
 * Re-reads the card on a timer, and never while a Lock is in flight.
 *
 * Only in the browser: what the server rendered is the card as it stood when
 * it was asked for.
 */
let rereading: ReturnType<typeof setInterval> | undefined;

onMounted(() => {
  rereading = setInterval(() => {
    if (!working.value) refresh();
  }, REREADS_EVERY);
});

onBeforeUnmount(() => clearInterval(rereading));
</script>

<template>
  <div class="min-h-dvh bg-surface text-on-surface font-body pb-44">
    <header
      class="sticky top-0 z-10 border-b border-outline-variant/25 bg-surface-container-high px-4 py-3"
    >
      <div class="flex items-center justify-between gap-4">
        <h1 class="font-headline text-base font-black uppercase truncate">
          {{ card?.title ?? "Live lock console" }}
        </h1>
        <!--
          The way off this screen, and the only two places worth going from it:
          the card itself, where a Bout is priced, opened or has its result
          entered, and the index. Both are desk work — nothing here does them —
          but an admin who finds nothing open needs somewhere to go and open it.
        -->
        <nav class="flex shrink-0 items-center gap-1 font-headline text-sm font-black uppercase">
          <NuxtLink
            v-if="card"
            :to="`/admin/events/${card.eventId}`"
            class="px-3 py-2 text-on-surface/70"
          >
            Card
          </NuxtLink>
          <NuxtLink to="/admin" class="px-3 py-2 text-on-surface/70">Admin</NuxtLink>
        </nav>
      </div>

      <p v-if="sweepIn" class="mt-1 flex items-baseline justify-between gap-4">
        <span class="text-xs uppercase tracking-widest text-on-surface/60">
          {{ CONSOLE_MESSAGES.sweep }}
        </span>
        <time :datetime="card?.sweepAt" class="text-lg font-bold tabular-nums">{{ sweepIn }}</time>
      </p>
    </header>

    <main class="px-4 pt-4">
      <ol v-if="card" class="flex flex-col gap-2">
        <li
          v-for="bout in card.bouts"
          :key="bout.id"
          class="border p-4"
          :class="
            isNext(bout)
              ? 'border-primary bg-primary-container/15'
              : 'border-outline-variant/20 bg-surface-container-low'
          "
        >
          <div class="flex items-baseline justify-between gap-3">
            <span class="font-headline text-sm font-black uppercase tracking-widest text-primary"
              >Bout {{ bout.cardOrder }}</span
            >
            <span
              class="text-xs font-bold uppercase tracking-widest"
              :class="stateOf(bout) === 'open' ? 'text-on-surface' : 'text-on-surface/50'"
            >
              {{ BOUT_STATE_LABELS[stateOf(bout)] }}
            </span>
          </div>

          <p class="mt-1 text-lg font-bold leading-tight">
            {{ bout.redName }} vs {{ bout.blueName }}
          </p>

          <p
            v-if="bout.mainEvent"
            class="mt-1 text-xs uppercase tracking-widest text-on-surface/50"
          >
            Main event
          </p>

          <p v-if="lockOf(bout)" class="mt-2 text-xs leading-relaxed text-on-surface/60">
            {{ lockOf(bout) }}
          </p>
        </li>
      </ol>

      <p v-else class="text-on-surface/80 leading-relaxed">{{ CONSOLE_MESSAGES.noCard }}</p>
    </main>

    <!--
      The one control, where a thumb is: fixed to the bottom of the screen, the
      height of a thumb, and about exactly one fight.
    -->
    <div
      v-if="card"
      class="fixed inset-x-0 bottom-0 border-t border-outline-variant/25 bg-surface-container-high px-4 py-4"
    >
      <p v-if="problem" class="mb-3 text-sm text-error" role="alert">{{ problem }}</p>

      <p v-else-if="next && !started" class="mb-3 text-xs leading-relaxed text-on-surface/70">
        {{ CONSOLE_MESSAGES.early }}
      </p>

      <!--
        A statement rather than a control that does nothing: for these seconds
        there is deliberately no button on the screen, so the tap that was
        going to land on one lands on nothing.
      -->
      <p
        v-if="resting && pressed"
        role="status"
        class="flex min-h-20 w-full items-center justify-center border border-outline-variant/40 px-4 py-5 text-center font-headline text-xl font-black uppercase tracking-wide text-on-surface/70"
      >
        {{ pressed.said }}
      </p>

      <button
        v-else-if="next"
        type="button"
        :disabled="working"
        class="w-full min-h-20 px-4 py-5 disabled:opacity-60"
        :class="
          started || asking
            ? 'bg-primary-container text-on-primary-container'
            : 'border border-primary text-primary'
        "
        @click="press"
      >
        <span class="block font-headline text-2xl font-black uppercase tracking-wide">
          {{ pressLabel }}
        </span>
        <span class="mt-1 block text-sm font-bold">{{ next.redName }} vs {{ next.blueName }}</span>
      </button>

      <p v-else class="text-sm leading-relaxed text-on-surface/80">{{ nothingToLock }}</p>
    </div>
  </div>
</template>
