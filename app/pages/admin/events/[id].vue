<script setup lang="ts">
import type { Corner } from "#shared/events";
import { LOCK_KIND_LABELS } from "#shared/locks";
import {
  METHODS,
  METHOD_LABELS,
  MULTIPLIER,
  outcomeLabel,
  QUESTIONS,
  QUESTION_LABELS,
  type Method,
} from "#shared/pricing";
import { RESULT_MESSAGES, resultLabel } from "#shared/results";

/**
 * Pricing one fight card, opening its Bouts for predictions, and locking them
 * again as it is fought.
 *
 * The screen ADR-0002 costs TFC. Multipliers are fixed by hand, so somebody
 * sits down with this before every card — which is why import seeds every
 * Outcome and this page is eight numbers to correct per Bout rather than a
 * blank form. It is deliberately plain, like the rest of the admin area
 * (ADR-0011).
 *
 * A Bout is priced, opened and locked on its own rather than the card in one
 * go. A card is rarely ready all at once — a late replacement on one Bout
 * leaves the rest of it perfectly openable — and opening is the door ADR-0001
 * shuts on re-importing the card, so it is done deliberately, one fight at a
 * time. Locking is the same shape for the reason ADR-0006 gives: Bouts lock
 * one after another while the card is fought, and keeping the later ones open
 * is the engagement case for the whole product.
 *
 * This is not the screen an admin locks from cageside — #20 builds that, on a
 * phone, one-handed, in the dark. What this is is where the Locks can be read
 * back afterwards: each Bout says how it came to be locked and when, which is
 * the answer to a fan who thinks theirs closed too early.
 *
 * The result form is the most consequential control in the product, and it is
 * deliberately the plainest thing on the page. Entering a result grades every
 * Entry riding on the Bout and pays the Rewards, in one transaction, and none
 * of that is taken back by pressing anything: a result entered wrong is
 * corrected by reversing what it settled and grading again (#16). So a Bout
 * that has been settled shows what was entered and offers no form at all.
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

/** The three Questions of a Bout, each with the Outcomes that answer it. */
function questionsOf(bout: (typeof bouts.value)[number]) {
  return QUESTIONS.map((question) => ({
    question,
    label: QUESTION_LABELS[question],
    outcomes: bout.outcomes.filter((outcome) => outcome.question === question),
  }));
}

/**
 * The two names this Bout is fought under, which is what a winner Outcome is
 * called. `outcomeLabel` names the rest, and names them the same way the card
 * a fan reads does.
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

/**
 * How a Bout came to be locked, in one line: what did it, when, and — where
 * somebody's action did it — who.
 *
 * The Lock audit log, read where the fight is. The moment is the one the Bout
 * stopped taking Predictions at, which is the only moment a fan asking about
 * it cares about. A Lock the clock performed names nobody, because naming the
 * admin who happened to be signed in would put a person against the clock's
 * work.
 */
function lockOf(bout: (typeof bouts.value)[number]): string | null {
  const lock = bout.lock;

  if (!lock) return null;

  return [LOCK_KIND_LABELS[lock.kind], inTbilisi(lock.at), lock.by].filter(Boolean).join(" · ");
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
const entered = ref<
  Record<string, { winner: Corner | ""; method: Method | ""; round: number | "" }>
>({});

watch(
  bouts,
  (card) => {
    entered.value = Object.fromEntries(
      card.map((bout) => [
        bout.id,
        entered.value[bout.id] ?? { winner: "", method: "", round: "" },
      ]),
    );
  },
  { immediate: true },
);

/** Whether a round can be named alongside the method chosen so far. */
function endsInARound(boutId: string): boolean {
  const method = entered.value[boutId]?.method;

  return method === "ko_tko" || method === "submission";
}

/** The rounds this Bout could have ended in, which are the ones it offered. */
function roundsOf(bout: (typeof bouts.value)[number]): number[] {
  return Array.from({ length: bout.scheduledRounds }, (_, index) => index + 1);
}

/** What was entered, as the admin reads it back on a settled Bout. */
function settledAs(bout: (typeof bouts.value)[number]): string | null {
  return bout.result ? resultLabel(bout.result, cornersOf(bout)) : null;
}

async function enterResult(bout: (typeof bouts.value)[number]) {
  const answered = entered.value[bout.id];

  working.value = bout.id;
  problem.value = "";
  done.value = "";

  try {
    const { settlement } = await $fetch(`/api/admin/bouts/${bout.id}/result`, {
      method: "POST",
      body: {
        winner: answered?.winner || null,
        method: answered?.method || null,
        round: endsInARound(bout.id) ? (answered?.round ?? null) || null : null,
      },
    });

    done.value = RESULT_MESSAGES.settled(settlement.graded, settlement.paid);

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
        not a price: nothing that wrote it knows which fighter is favoured. Adjust the eight numbers
        on a Bout, save them, and the Bout can be opened. A method or a round is priced knowing it
        multiplies onto the winner the fan picked, so
        <em>Submission</em> means "given that your fighter wins".
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
        <p v-if="lockOf(bout)" class="mt-1 text-sm text-on-surface/70">{{ lockOf(bout) }}</p>
        <p v-if="settledAs(bout)" class="mt-1 text-sm text-on-surface/70">
          Result: {{ settledAs(bout) }}
        </p>

        <div v-for="asked in questionsOf(bout)" :key="asked.question" class="mt-6">
          <h3 class="font-headline text-xs font-black uppercase tracking-widest">
            {{ asked.label }}
          </h3>

          <div class="mt-3 flex flex-wrap gap-4">
            <label
              v-for="outcome in asked.outcomes"
              :key="outcome.id"
              class="flex items-center gap-2 text-sm"
            >
              <span class="min-w-32">{{ outcomeLabel(outcome, cornersOf(bout)) }}</span>
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

        <div
          v-if="bout.status === 'open' || bout.status === 'locked'"
          class="mt-6 border-t border-outline-variant/20 pt-6"
        >
          <h3 class="font-headline text-xs font-black uppercase tracking-widest">Result</h3>

          <p class="mt-2 text-sm text-on-surface/70">
            Entering this grades every Entry on the Bout and pays the Rewards, in one go. It is not
            taken back by entering it again: a result entered wrong is corrected by reversing what
            it settled and grading afresh.
          </p>

          <div v-if="entered[bout.id]" class="mt-3 flex flex-wrap items-center gap-4 text-sm">
            <label class="flex items-center gap-2">
              <span>Winner</span>
              <select
                v-model="entered[bout.id]!.winner"
                :aria-label="`Winner of Bout ${bout.cardOrder}`"
                class="border border-outline-variant/40 bg-surface px-2 py-1"
              >
                <option value="">Choose</option>
                <option value="red">{{ bout.redName }}</option>
                <option value="blue">{{ bout.blueName }}</option>
              </select>
            </label>

            <label class="flex items-center gap-2">
              <span>Method</span>
              <select
                v-model="entered[bout.id]!.method"
                :aria-label="`Method of victory in Bout ${bout.cardOrder}`"
                class="border border-outline-variant/40 bg-surface px-2 py-1"
              >
                <option value="">Choose</option>
                <option v-for="method in METHODS" :key="method" :value="method">
                  {{ METHOD_LABELS[method] }}
                </option>
              </select>
            </label>

            <label v-if="endsInARound(bout.id)" class="flex items-center gap-2">
              <span>Round</span>
              <select
                v-model.number="entered[bout.id]!.round"
                :aria-label="`Round Bout ${bout.cardOrder} ended in`"
                class="border border-outline-variant/40 bg-surface px-2 py-1"
              >
                <option value="">Choose</option>
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
              Enter result and settle
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
