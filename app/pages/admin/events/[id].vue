<script setup lang="ts">
import type { Corner } from "#shared/events";
import {
  answerLabel,
  CORNERS,
  MULTIPLIER,
  outcomeLabel,
  QUESTIONS,
  QUESTION_LABELS,
} from "#shared/pricing";
import {
  boutEndingLabel,
  isFinish,
  NO_RESULT_LABELS,
  NO_RESULT_REASONS,
  RECORDED_METHODS,
  RECORDED_METHOD_LABELS,
  RESULT_MESSAGES,
  type EnteredEnding,
  type Correction,
  type NoResultReason,
  type RecordedMethod,
  type Settlement,
} from "#shared/results";

/**
 * Pricing one fight card, opening its Bouts for predictions, and locking them
 * again as it is fought.
 *
 * The screen ADR-0002 costs TFC. Multipliers are fixed by hand, so somebody
 * sits down with this before every card — which is why import seeds every
 * Outcome and this page is numbers to correct per Bout rather than a blank
 * form. Fourteen to eighteen of them, since every answer names the fighter it
 * is about (ADR-0015), which is what {@link questionsOf} lays out a corner at
 * a time: six "Tsiklauri by Submission"-width labels down one column is a
 * screen an admin loses their place in. It is deliberately plain otherwise,
 * like the rest of the admin area (ADR-0011).
 *
 * Every Outcome is offered, unfiltered, and that is not the card's decision:
 * a Bout with any unpriced Outcome cannot be opened, so an admin who could not
 * reach the method and round numbers could not open a Bout at all.
 *
 * A Bout is priced, opened and locked on its own rather than the card in one
 * go. A card is rarely ready all at once — a late replacement on one Bout
 * leaves the rest of it perfectly openable — and opening is the door ADR-0001
 * shuts on re-importing the card, so it is done deliberately, one fight at a
 * time. Locking is the same shape for the reason ADR-0006 gives: Bouts lock
 * one after another while the card is fought, and keeping the later ones open
 * is the engagement case for the whole product.
 *
 * This is not the screen an admin locks from cageside: `/admin/console` is
 * that, on a phone, one-handed, in the dark. What this is is where the Locks
 * are read back afterwards, in `lockLine`'s words — each Bout says how it came
 * to be locked and when, which is the answer to a fan who thinks theirs closed
 * too early.
 *
 * The result form is the most consequential control in the product, and it is
 * deliberately the plainest thing on the page. Entering a result grades every
 * Entry riding on the Bout and pays the Rewards, in one transaction, and none
 * of that is taken back by pressing it again.
 *
 * A Bout that has settled shows what it was recorded as, and the same form
 * becomes the one that corrects it. The same three answers about the same
 * fight, and a Bout is only ever offering one of the two — so what changes is
 * the paragraph in front of it, the words on the buttons and where they post.
 * The paragraph is the part that matters: correcting takes Coins back off fans
 * who have been told they won, and an admin should be reading that before they
 * press anything. Underneath, it reverses the Coin Transactions the first
 * result wrote and grades every Entry again (ADR-0003).
 *
 * Every correction a Bout has had is listed beneath it, oldest first: what it
 * used to be recorded as, who changed it and when. That is the answer to the
 * fan whose Entry was Won on Sunday and is Lost on Monday, and it belongs
 * beside the fight it is about rather than in a query somebody would have to
 * know to run.
 *
 * A Bout that produced nothing gradable is entered beside it rather than
 * through it, as a No Result naming which of the four it was (ADR-0005). Two
 * controls rather than one, because they are two different statements about
 * the fight and an admin should not be able to slide from one to the other by
 * leaving a select alone: a Result says who won, and a No Result says nobody
 * did. Both settle the Bout, and only one of them can be entered.
 *
 * Nothing here decides who may price a card: `server/middleware/admin.ts`
 * refused everyone else before this page was rendered at all.
 */
useSeoMeta({
  title: "Pricing a card",
  description: "Setting the Multipliers on a fight card in TFC Predictions.",
  robots: "noindex",
});

const route = useRoute();
const request = useRequestFetch();

const {
  data: card,
  error,
  refresh,
} = await useAsyncData(`admin-card-${route.params.id}`, () =>
  request(`/api/admin/events/${route.params.id}`),
);

// An admin following a link to a card a re-import has since replaced is told
// the card is gone; a fan who guessed the URL was refused by the API before
// any of this rendered, and gets the refusal the rest of the admin area gives
// them. The two are not the same page.
if (!card.value) throw noAnswerFrom(error.value);

const bouts = computed(() => card.value?.bouts ?? []);

/** The smallest Multiplier that is a price: above 1, to the places stored. */
const smallest = MULTIPLIER.above + 10 ** -MULTIPLIER.decimals;

/**
 * What is currently typed into each Outcome's box, keyed by Outcome.
 *
 * Rebuilt from the answer whenever it changes, which is after a save or an
 * opening — so what an admin is looking at is always what the game holds,
 * rather than a number they typed and a refusal they have scrolled past.
 */
const typed = ref<Record<string, number>>({});

watch(
  bouts,
  (card) => {
    typed.value = Object.fromEntries(
      card.flatMap((bout) => bout.outcomes.map((outcome) => [outcome.id, outcome.multiplier])),
    );
  },
  { immediate: true },
);

const working = ref("");
const problem = ref("");
const done = ref("");

/**
 * The three Questions of a Bout, each grouped by the fighter its answers are
 * about.
 *
 * Two rows per Question — one per corner, red first — because that is the
 * shape the answers have (ADR-0015) and because it is what keeps fourteen to
 * eighteen inputs readable: the fighter is named once at the head of a row,
 * and the boxes under it are the answers about them. `answerLabel` is what
 * names those, and `outcomeLabel` still names the whole answer to a screen
 * reader, so the two ways of reading the page say the same thing.
 *
 * Every Question and every answer to it, unfiltered: a Bout with one unpriced
 * Outcome cannot be opened, so an answer this screen did not offer would be a
 * Bout an admin could never open. The one thing dropped is a corner with no
 * answers under it, which would be an empty row — and on any Bout import
 * wrote, there is no such corner.
 */
function questionsOf(bout: (typeof bouts.value)[number]) {
  const named = cornersOf(bout);

  return QUESTIONS.map((question) => ({
    question,
    label: QUESTION_LABELS[question],
    corners: CORNERS.map((corner) => ({
      corner,
      fighter: named[corner],
      outcomes: bout.outcomes.filter(
        (outcome) => outcome.question === question && outcome.corner === corner,
      ),
    })).filter((side) => side.outcomes.length > 0),
  }));
}

/**
 * The two names this Bout is fought under, which every answer on it names
 * (ADR-0015). `outcomeLabel` writes the whole of one, and writes it the same
 * way the card a fan reads does.
 */
function cornersOf(bout: (typeof bouts.value)[number]) {
  return { red: bout.redName, blue: bout.blueName };
}

/** Where a Bout is: unpriced, priced, taking Predictions, done, or settled. */
function stateOf(bout: (typeof bouts.value)[number]): string {
  if (bout.status === "settled") return "Settled";
  if (bout.status === "locked") return "Locked";
  if (bout.status === "open") return "Open for predictions";

  return bout.priced ? "Priced, not yet open" : "Nobody has priced this Bout";
}

async function priceBout(bout: (typeof bouts.value)[number]) {
  working.value = bout.id;
  problem.value = "";
  done.value = "";

  try {
    await $fetch(`/api/admin/bouts/${bout.id}/multipliers`, {
      method: "POST",
      body: {
        multipliers: Object.fromEntries(
          bout.outcomes.map((outcome) => [outcome.id, typed.value[outcome.id]]),
        ),
      },
    });

    done.value = `Bout ${bout.cardOrder} is priced: ${bout.redName} against ${bout.blueName}.`;

    await refresh();
  } catch (failure) {
    problem.value = problemFrom(failure);
  } finally {
    working.value = "";
  }
}

async function openBout(bout: (typeof bouts.value)[number]) {
  working.value = bout.id;
  problem.value = "";
  done.value = "";

  try {
    await $fetch(`/api/admin/bouts/${bout.id}/open`, { method: "POST" });

    done.value =
      `Bout ${bout.cardOrder} is open for predictions. The card can no longer ` +
      "be re-imported: fans hold Coins against these Bouts from now on.";

    await refresh();
  } catch (failure) {
    problem.value = problemFrom(failure);
  } finally {
    working.value = "";
  }
}

/**
 * What is currently chosen in each Bout's result form, keyed by Bout.
 *
 * The round only goes with a finish, so the control for it is offered only
 * alongside one, and nothing is sent for it otherwise. `parseResult` refuses
 * that pairing regardless, and Postgres refuses it under that — this is so an
 * admin is not left looking at a control that means nothing.
 *
 * Kept across a refresh rather than rebuilt from the answer, unlike the
 * Multipliers above: a result refused for its round is one an admin still has
 * most of right, and clearing it would make them enter the whole thing again.
 */
const entered = ref<Record<string, Required<EnteredEnding>>>({});

watch(
  bouts,
  (card) => {
    entered.value = Object.fromEntries(
      card.map((bout) => [
        bout.id,
        entered.value[bout.id] ?? { winner: null, method: null, round: null, noResult: null },
      ]),
    );
  },
  { immediate: true },
);

/** The four reasons, with what each is called, for the No Result control. */
const noResultReasons = NO_RESULT_REASONS.map((reason) => ({
  reason,
  label: NO_RESULT_LABELS[reason],
}));

/** The ways a Bout ends with a winner, disqualification included. */
const recordedMethods = RECORDED_METHODS.map((method) => ({
  method,
  label: RECORDED_METHOD_LABELS[method],
}));

/** Whether a round can be named alongside the method chosen so far. */
function endsInARound(boutId: string): boolean {
  return isFinish(entered.value[boutId]?.method ?? null);
}

/** The rounds this Bout could have ended in, which are the ones it offered. */
function roundsOf(bout: (typeof bouts.value)[number]): number[] {
  return Array.from({ length: bout.scheduledRounds }, (_, index) => index + 1);
}

/** What was entered, as the admin reads it back on a settled Bout. */
function settledAs(bout: (typeof bouts.value)[number]): string | null {
  return bout.ending ? boutEndingLabel(bout.ending, cornersOf(bout)) : null;
}

/**
 * One correction in a line: what the Bout used to be recorded as, who changed
 * it, and when.
 *
 * The same shape `lockLine` writes a Lock in, because they are read for the same
 * reason — a fan is unhappy about one fight, and somebody has to be able to
 * say what happened to it.
 */
function correctedFrom(
  bout: (typeof bouts.value)[number],
  correction: (typeof bout.corrections)[number],
): string {
  const was = boutEndingLabel(correction.ending, cornersOf(bout));

  return `Was ${was} · corrected ${inTbilisi(correction.at)} · ${correction.by}`;
}

/**
 * Whether this Bout's form is correcting a result rather than entering one.
 *
 * The two are one form, because they ask for the same three answers about the
 * same fight and a Bout is only ever offering one of them: a Bout still being
 * fought has no result to correct, and a settled one is finished with being
 * settled. What differs is the sentence in front of it, the words on the
 * buttons and where they post — which is enough, because an admin correcting a
 * result is reading a paragraph that says so.
 */
function correcting(bout: (typeof bouts.value)[number]): boolean {
  return bout.status === "settled";
}

async function enterResult(bout: (typeof bouts.value)[number]) {
  const answered = entered.value[bout.id];
  const ending = {
    winner: answered?.winner ?? null,
    method: answered?.method ?? null,
    // A round only means anything alongside a finish, so a Decision and a
    // disqualification send none whatever is still sitting in the control
    // behind them.
    round: endsInARound(bout.id) ? (answered?.round ?? null) : null,
  };

  if (correcting(bout)) return correct(bout, ending);

  await settle(bout, RESULT_MESSAGES.settled, ending);
}

/**
 * Enters the No Result the Bout produced, and nothing else.
 *
 * The reason is the whole body. Pressing this button is an unambiguous
 * statement that nothing about the Bout can be graded, so whatever is left
 * sitting in the result controls above is not part of it — refusing over a
 * select an admin did not clear would be the page arguing with a decision they
 * have already made.
 *
 * It is sent even when it is null, and that is the point: `parseEnding` reads
 * the field being there as this control having been the one used, so an admin
 * who has not said why is told to say why rather than to choose a winner.
 */
async function enterNoResult(bout: (typeof bouts.value)[number]) {
  const ending = { noResult: entered.value[bout.id]?.noResult ?? null };

  if (correcting(bout)) return correct(bout, ending);

  await settle(bout, RESULT_MESSAGES.noResultEntered, ending);
}

/**
 * The one request behind both, because they are the same button pressed about
 * two different fights: the route settles the Bout, grades every Entry on it
 * and moves the Coins, whichever of the two arrives.
 */
async function settle(
  bout: (typeof bouts.value)[number],
  said: (settlement: Settlement) => string,
  body: EnteredEnding,
) {
  await reportOn(bout, async () => {
    const { settlement } = await $fetch(`/api/admin/bouts/${bout.id}/result`, {
      method: "POST",
      body,
    });

    return said(settlement);
  });
}

/**
 * The request behind both correction buttons: the same two statements about
 * the fight, sent to the route that reverses what the first result paid and
 * grades every Entry again.
 *
 * One sentence answers both, unlike entering a result, because there is only
 * one thing worth saying about a correction and it is the same either way: how
 * many Entries were re-graded, and how many Coins were taken back and handed
 * out.
 */
async function correct(bout: (typeof bouts.value)[number], body: EnteredEnding) {
  await reportOn(bout, async () => {
    const { correction } = await $fetch(`/api/admin/bouts/${bout.id}/correction`, {
      method: "POST",
      body,
    });

    return RESULT_MESSAGES.corrected(correction);
  });
}

/**
 * Every control on this page that moves Coins, around the one thing that
 * differs: the Bout is marked busy, the last answer is cleared, what happened
 * is said, and the card is read back.
 *
 * The request itself is the caller's rather than a path handed in, because the
 * two routes answer with two shapes — entering a result with a `Settlement`,
 * correcting one with a `Correction` — and because a `$fetch` of a path this
 * function was given is a `$fetch` Nuxt cannot type.
 */
async function reportOn(bout: (typeof bouts.value)[number], run: () => Promise<string>) {
  working.value = bout.id;
  problem.value = "";
  done.value = "";

  try {
    done.value = await run();

    await refresh();
  } catch (failure) {
    problem.value = problemFrom(failure);
  } finally {
    working.value = "";
  }
}

async function lockBout(bout: (typeof bouts.value)[number]) {
  working.value = bout.id;
  problem.value = "";
  done.value = "";

  try {
    await $fetch(`/api/admin/bouts/${bout.id}/lock`, { method: "POST" });

    done.value =
      `Bout ${bout.cardOrder} has locked and takes no further Predictions. A ` +
      "Lock is never taken back.";

    await refresh();
  } catch (failure) {
    problem.value = problemFrom(failure);
  } finally {
    working.value = "";
  }
}
</script>

<template>
  <PageHeading :text="card?.title ?? 'Pricing a card'" />

  <section class="px-6 md:px-20 pb-24">
    <div class="max-w-5xl mx-auto">
      <p class="text-on-surface/80 leading-relaxed">
        Every Outcome arrived with a Multiplier from a fixed table, which is a starting point and
        not a price: nothing that wrote it knows which fighter is favoured. Adjust the fourteen to
        eighteen numbers on a Bout, save them, and the Bout can be opened. Every answer names the
        fighter it is about and every Multiplier stands for that answer outright, so
        <em>Tsiklauri by Submission</em> is what that fighter winning that way pays — and it is a
        different number from the same finish by the other corner.
      </p>

      <p class="mt-4 text-on-surface/80 leading-relaxed">
        Lock a Bout to stop it taking Predictions. The Bout fought first locks by itself when the
        card starts, and everything still open locks a few hours later whatever anybody remembered —
        but between those two it is an admin who advances the Lock as the card is fought. A Lock is
        never taken back, and each one is recorded here with the moment the Bout actually closed.
      </p>

      <p v-if="card" class="mt-4 text-sm text-on-surface/70">
        {{ inTbilisi(card.scheduledStart) }} · {{ card.venue }} · {{ card.seasonName }} ·
        <NuxtLink to="/admin/events" class="underline">All cards</NuxtLink>
      </p>

      <p v-if="done" class="mt-6 text-sm text-on-surface/80" role="status">{{ done }}</p>
      <p v-if="problem" class="mt-6 text-sm text-error" role="alert">{{ problem }}</p>

      <article
        v-for="bout in bouts"
        :key="bout.id"
        class="mt-10 border border-outline-variant/20 bg-surface-container-low p-6"
      >
        <header class="flex flex-wrap items-baseline justify-between gap-2">
          <h2 class="font-headline text-lg font-black uppercase">
            {{ bout.cardOrder }}. {{ bout.redName }} vs {{ bout.blueName }}
          </h2>
          <p class="text-sm text-on-surface/70">
            {{ bout.division }} · {{ bout.scheduledRounds }} rounds
            <template v-if="bout.mainEvent"> · Main event</template>
            <template v-if="bout.titleFight"> · Title fight</template>
          </p>
        </header>

        <p class="mt-2 text-sm font-bold">{{ stateOf(bout) }}</p>
        <p v-if="bout.lock" class="mt-1 text-sm text-on-surface/70">{{ lockLine(bout.lock) }}</p>
        <p v-if="settledAs(bout)" class="mt-1 text-sm text-on-surface/70">
          Result: {{ settledAs(bout) }}
        </p>
        <p
          v-for="correction in bout.corrections"
          :key="correction.at"
          class="mt-1 text-sm text-on-surface/70"
        >
          {{ correctedFrom(bout, correction) }}
        </p>

        <!--
          A Question at a time, and within it a fighter at a time. The name is
          the row's heading rather than the head of every label, which is what
          keeps six method boxes and up to ten round boxes readable.
        -->
        <div v-for="asked in questionsOf(bout)" :key="asked.question" class="mt-6">
          <h3 class="font-headline text-xs font-black uppercase tracking-widest">
            {{ asked.label }}
          </h3>

          <div
            v-for="side in asked.corners"
            :key="side.corner"
            class="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-2 md:flex-nowrap md:items-start"
          >
            <p class="w-full shrink-0 text-sm font-bold md:w-48">{{ side.fighter }}</p>

            <div class="flex flex-wrap gap-x-4 gap-y-2">
              <label
                v-for="outcome in side.outcomes"
                :key="outcome.id"
                class="flex items-center gap-2 text-sm"
              >
                <span class="min-w-24">{{ answerLabel(outcome) }}</span>
                <span aria-hidden="true">×</span>
                <input
                  v-model.number="typed[outcome.id]"
                  type="number"
                  :min="smallest"
                  :max="MULTIPLIER.maximum"
                  step="0.01"
                  :aria-label="`${asked.label}: ${outcomeLabel(outcome, cornersOf(bout))}`"
                  class="w-24 border border-outline-variant/40 bg-surface px-2 py-1"
                />
                <span v-if="!outcome.priced" class="text-xs text-on-surface/60">seeded</span>
              </label>
            </div>
          </div>
        </div>

        <div v-if="bout.status !== 'closed'" class="mt-6 border-t border-outline-variant/20 pt-6">
          <h3 class="font-headline text-xs font-black uppercase tracking-widest">
            {{ correcting(bout) ? "Correct the result" : "Result" }}
          </h3>

          <p v-if="correcting(bout)" class="mt-2 text-sm text-on-surface/70">
            Only if what is recorded above is not what happened. Correcting reverses the Coins this
            Bout has already moved and grades every Entry on it again: fans whose Entry now wins are
            paid, and fans who were paid on the earlier result have it taken back. Nothing is erased
            — the Reward, the row that reverses it and the one that replaces it all stay in the
            ledger, and what the Bout used to be recorded as is kept beside it.
          </p>

          <p v-else class="mt-2 text-sm text-on-surface/70">
            Entering this grades every Entry on the Bout and pays the Rewards, in one go. It is not
            taken back by entering it again: a result entered wrong is corrected by reversing what
            it settled and grading afresh.
          </p>

          <div v-if="entered[bout.id]" class="mt-3 flex flex-wrap items-center gap-4 text-sm">
            <label class="flex items-center gap-2">
              <span>Winner</span>
              <select
                v-model="entered[bout.id]!.winner"
                :aria-label="`${correcting(bout) ? 'Corrected winner' : 'Winner'} of Bout ${bout.cardOrder}`"
                class="border border-outline-variant/40 bg-surface px-2 py-1"
              >
                <option :value="null">Choose</option>
                <option value="red">{{ bout.redName }}</option>
                <option value="blue">{{ bout.blueName }}</option>
              </select>
            </label>

            <label class="flex items-center gap-2">
              <span>Method</span>
              <select
                v-model="entered[bout.id]!.method"
                :aria-label="`${correcting(bout) ? 'Corrected method' : 'Method'} of victory in Bout ${bout.cardOrder}`"
                class="border border-outline-variant/40 bg-surface px-2 py-1"
              >
                <option :value="null">Choose</option>
                <option v-for="ended in recordedMethods" :key="ended.method" :value="ended.method">
                  {{ ended.label }}
                </option>
              </select>
            </label>

            <label v-if="endsInARound(bout.id)" class="flex items-center gap-2">
              <span>Round</span>
              <select
                v-model.number="entered[bout.id]!.round"
                :aria-label="`${correcting(bout) ? 'Corrected round' : 'Round'} Bout ${bout.cardOrder} ended in`"
                class="border border-outline-variant/40 bg-surface px-2 py-1"
              >
                <option :value="null">Choose</option>
                <option v-for="round in roundsOf(bout)" :key="round" :value="round">
                  Round {{ round }}
                </option>
              </select>
            </label>

            <button
              type="button"
              :disabled="working === bout.id"
              class="bg-primary-container text-white font-headline text-xs font-black uppercase tracking-widest px-4 py-3 disabled:opacity-60"
              @click="enterResult(bout)"
            >
              {{ correcting(bout) ? "Correct and re-grade" : "Enter result and settle" }}
            </button>
          </div>

          <p class="mt-6 text-sm text-on-surface/70">
            If the Bout produced nothing to grade — it was cancelled, a fighter withdrew, it was a
            draw or a no contest — {{ correcting(bout) ? "correct it to that" : "enter that" }}
            instead. Every Prediction on it then counts as ×1.0 and the rest of each Entry plays on;
            an Entry with nothing else left to decide has its Coins returned in full.
          </p>

          <div v-if="entered[bout.id]" class="mt-3 flex flex-wrap items-center gap-4 text-sm">
            <label class="flex items-center gap-2">
              <span>No Result</span>
              <select
                v-model="entered[bout.id]!.noResult"
                :aria-label="`Why Bout ${bout.cardOrder} produced no result${correcting(bout) ? ' after all' : ''}`"
                class="border border-outline-variant/40 bg-surface px-2 py-1"
              >
                <option :value="null">Choose</option>
                <option v-for="why in noResultReasons" :key="why.reason" :value="why.reason">
                  {{ why.label }}
                </option>
              </select>
            </label>

            <button
              type="button"
              :disabled="working === bout.id"
              class="border border-outline-variant/40 font-headline text-xs font-black uppercase tracking-widest px-4 py-3 disabled:opacity-60"
              @click="enterNoResult(bout)"
            >
              {{ correcting(bout) ? "Correct to a No Result" : "Enter No Result and settle" }}
            </button>
          </div>
        </div>

        <div class="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            :disabled="working === bout.id"
            class="bg-primary-container text-white font-headline text-xs font-black uppercase tracking-widest px-4 py-3 disabled:opacity-60"
            @click="priceBout(bout)"
          >
            Save Multipliers
          </button>
          <button
            type="button"
            :disabled="working === bout.id || !bout.priced || bout.status !== 'closed'"
            class="border border-outline-variant/40 font-headline text-xs font-black uppercase tracking-widest px-4 py-3 disabled:opacity-60"
            @click="openBout(bout)"
          >
            {{ bout.status === "closed" ? "Open for predictions" : "Open" }}
          </button>
          <button
            type="button"
            :disabled="working === bout.id || bout.status !== 'open'"
            class="border border-outline-variant/40 font-headline text-xs font-black uppercase tracking-widest px-4 py-3 disabled:opacity-60"
            @click="lockBout(bout)"
          >
            {{ bout.status === "locked" ? "Locked" : "Lock" }}
          </button>
        </div>
      </article>

      <p v-if="bouts.length === 0" class="mt-10 text-on-surface/70">
        This card has no Bouts in the game. Re-import it from
        <NuxtLink to="/admin/events" class="underline">the card listing</NuxtLink>.
      </p>
    </div>
  </section>
</template>
