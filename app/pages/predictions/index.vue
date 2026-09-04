<script setup lang="ts">
import {
  entryProgress,
  priceOf,
  type CommittedEntries,
  type DraftPrediction,
} from "#shared/entries";
import { boutState, PREDICTION_MESSAGES } from "#shared/predictions";
import type { OutcomeAnswer } from "#shared/pricing";

/**
 * The card, and the Entry a fan builds on it.
 *
 * The page PlayTFC opens on, and the only page of the game a fan needs open
 * while a card is being fought. Three parts, in the order they are read: the
 * strip that says which card this is and how long there is left, the card
 * itself, and the panel holding what has been answered so far. Between them is
 * this page, which owns the one piece of state they share — what the fan has
 * answered, by Bout — because the card is where answers are given and the
 * panel is where they are committed.
 *
 * `SubmittedEntries` is what happened afterwards: the Entries this fan holds,
 * and the button that takes one back while every Bout in it is still open
 * (#13). It is here rather than on the profile because the reason a fan
 * cancels is nearly always the card in front of them.
 *
 * The Entry is priced here from the card in front of the fan, by the same
 * function the server prices it with when it arrives (`priceOf`). So the
 * Reward on the panel is the Reward the game promises, and the two cannot come
 * to disagree — which is the whole point of ADR-0002's fixed Multipliers.
 *
 * Never edge-cached, for both of ADR-0008's reasons: it reads a session, and a
 * card ten minutes stale is a Bout shown open that locked eight minutes ago.
 * See `route-rules.ts`.
 */
const { data } = await useAsyncData("upcoming-card", () => $fetch("/api/predictions/card"));
const { data: fan } = await useFan();

const card = computed(() => data.value?.card ?? null);
const predictions = computed(() => data.value?.predictions ?? null);

/**
 * The one clock on this page, held here rather than in either half of it.
 *
 * The strip counts down to the first Lock and the card counts down inside each
 * Bout, and two clocks started a moment apart are two answers to "has this
 * locked". Seeded from the moment the server answered — see {@link useNow}.
 */
const now = useNow(predictions.value?.answeredAt);

/**
 * The Entries this fan has already committed, for the panel that can take one
 * back.
 *
 * Asked for only when somebody is signed in, and asked again whenever that
 * changes: a visitor holds none, and the answer is one fan's own. Submitting
 * an Entry and cancelling one both change it, and both say so.
 *
 * Through `useRequestFetch` for the reason `useFan` is: this runs during
 * server rendering too, and a plain `$fetch` there carries no cookie — the
 * route would answer 401 and the page would fail rendering for exactly the
 * fans it is for.
 */
const request = useRequestFetch();

const { data: committed, refresh: refreshCommitted } = await useAsyncData<CommittedEntries | null>(
  "committed-entries",
  async () => (fan.value ? await request<CommittedEntries>("/api/predictions/entries") : null),
  { watch: [fan] },
);

/**
 * What the fan has answered, by the Bout it answers.
 *
 * One answer per Bout, because that is what an Entry may hold (ADR-0014) —
 * answering a second Question on a Bout replaces what is here rather than
 * standing beside it.
 *
 * Keyed by Bout id rather than by place on the card, because that is what an
 * Entry is submitted against — and a Bout keeps its id when a card is
 * re-imported into a different order.
 */
const picks = ref<Record<string, OutcomeAnswer>>({});

/** Takes the answer the card just gave, or drops the Bout from the Entry. */
function answer(boutId: string, pick: OutcomeAnswer | null) {
  const answered = { ...picks.value };

  if (pick === null) {
    delete answered[boutId];
  } else {
    answered[boutId] = pick;
  }

  picks.value = answered;
}

/** Every Bout the game is offering answers on, with what they pay. */
const boutsInTheGame = computed(() =>
  (card.value?.bouts ?? []).flatMap((bout) => {
    const held = predictions.value?.bouts[bout.cardOrder];

    if (!held) return [];

    return [
      {
        id: held.boutId,
        cardOrder: bout.cardOrder,
        corners: { red: bout.red.name, blue: bout.blue.name },
        outcomes: held.outcomes,
        state: boutState(held, now.value),
      },
    ];
  }),
);

/**
 * The Entry as it stands: every answer, priced from what the card is offering,
 * in the order the Bouts are fought.
 *
 * An answer the card no longer offers is dropped rather than shown at some
 * other Multiplier — it can only happen to a page left open across a
 * re-import, and the server refuses the Entry either way.
 */
const draft = computed<DraftPrediction[]>(() =>
  boutsInTheGame.value.flatMap((bout) => {
    const pick = picks.value[bout.id];

    if (!pick) return [];

    const multiplier = priceOf(pick, bout.outcomes);

    if (multiplier === null) return [];

    return [
      { ...pick, multiplier, boutId: bout.id, cardOrder: bout.cardOrder, corners: bout.corners },
    ];
  }),
);

/**
 * How far through the card the fan is, for the strip at the top of it.
 *
 * Counted against the Bouts that can actually be answered — open, and priced
 * — rather than against every Bout on the card, so the bar fills as a fan
 * works through what is in front of them rather than stopping short at
 * whatever an admin has not opened yet. Both halves are counted over the same
 * Bouts, so an Entry holding answers on Bouts that have since locked cannot
 * read as more answered than there is to answer.
 */
const progress = computed(() => {
  const answerable = boutsInTheGame.value.filter(
    (bout) => bout.state === "open" && bout.outcomes.length > 0,
  );

  return entryProgress(
    answerable.filter((bout) => picks.value[bout.id] !== undefined).length,
    answerable.length,
  );
});

/** Takes every answer back, for a fan starting the card again. */
function clear() {
  picks.value = {};
}

/** Clears the card the Entry was built on, and lists the Entry it became. */
async function submitted() {
  picks.value = {};
  await refreshCommitted();
}

useSeoMeta({
  title: () => card.value?.title ?? "TFC Predictions",
  description: () =>
    card.value
      ? `Every Bout on ${card.value.title}, and what each answer pays in TFC Predictions.`
      : "The upcoming TFC card, and what each answer pays in TFC Predictions.",
});
</script>

<template>
  <FightCardHeader v-if="card" :card="card" :now="now" :progress="progress" />
  <PageHeading v-else text="TFC Predictions" />

  <section class="px-6 md:px-20 pt-10 pb-28 lg:pb-24">
    <div class="max-w-[1440px] mx-auto">
      <template v-if="card">
        <p class="max-w-3xl text-on-surface/80 leading-relaxed">
          Answer any Bout — which fighter wins, or how they win — and that one answer is a whole
          Prediction at the Multiplier beside it. Chain Predictions across Bouts into one Entry,
          commit your Coins, and a Bout stops taking Predictions the moment it locks.
        </p>

        <div class="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
          <FightCard
            :card="card"
            :predictions="predictions"
            :picks="picks"
            :now="now"
            @pick="answer"
          />

          <EntryBuilder
            :predictions="draft"
            :fan="fan ?? null"
            class="lg:sticky lg:top-28"
            @remove="answer($event, null)"
            @clear="clear"
            @submitted="submitted"
          />
        </div>
      </template>

      <p v-else class="text-on-surface/70 max-w-2xl leading-relaxed">
        {{ PREDICTION_MESSAGES.noCard }}
      </p>

      <!--
        Outside the card, deliberately. An Entry outlives the card it was built
        on: between Events there is nothing to pick and a fan still has Entries
        to read, and one of them may still be theirs to cancel.
      -->
      <SubmittedEntries
        v-if="committed"
        :entries="committed.entries"
        :answered-at="committed.answeredAt"
        class="mt-16"
        @cancelled="refreshCommitted"
      />
    </div>
  </section>

  <PageCrossLink
    to="/leaderboard"
    heading="Every Coin you hold is a place on the board"
    label="See the leaderboard"
  />
</template>
