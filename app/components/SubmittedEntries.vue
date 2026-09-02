<script setup lang="ts">
import { coinsLabel } from "#shared/coins";
import {
  CANCELLATION_MESSAGES,
  ENTRY_STATUS_LABELS,
  cancellationOf,
  type CommittedEntry,
} from "#shared/entries";
import { multiplierLabel } from "#shared/predictions";
import { outcomeLabel } from "#shared/pricing";
import { endingNote, entryAsItStands } from "#shared/results";

/**
 * The Entries a fan has committed on this Season, and the one thing they can
 * still do about one: take it back.
 *
 * Beside the card rather than on the profile page, because the reason a fan
 * cancels is almost always the card — a fighter withdrew, a Bout moved — and
 * the moment they want the button is the moment they are looking at what
 * changed. The history that goes back through every Season, with each
 * Prediction of a chain graded, is `EntryHistory` on the profile.
 *
 * **Whether an Entry can be cancelled is decided here, from the clock.** Every
 * Prediction carries where its Bout stands and the moment it locks by itself,
 * and `cancellationOf` is the same function the route decides with — so the
 * button stops being offered at the instant the first Bout in an Entry locks,
 * rather than at the next time somebody asks the server. A fan who presses it
 * in that last second is refused with the sentence shown here.
 *
 * A cancelled Entry stays in the list. It is Coins that moved and a decision
 * the fan made, and a listing it vanished from would be a fan wondering what
 * became of an Entry they remember submitting.
 *
 * The reason an Entry cannot be cancelled is shown only under the ones that
 * are still Open, because that is where it is news. "There is nothing left to
 * cancel" under a settled Entry is a sentence about a button nobody was
 * looking for, and the status beside the Amount already says where it is.
 *
 * What the chain is worth is `entryAsItStands` in `shared/results.ts`, which
 * is also what the Entry history on the profile prices its Entries with — so
 * one Entry cannot come to be worth two different numbers on the two pages a
 * fan can have open at the same time.
 *
 * **A Prediction whose answer stopped counting says so, and says why.** It is
 * the only place a fan finds out that a Bout was cancelled, lost a fighter,
 * drew, was ruled a no contest, or ended in the disqualification that leaves a
 * method or round Prediction with nothing to grade — and a Multiplier that quietly
 * dropped to ×1.0 with no sentence beside it reads as the game having taken
 * something away rather than as ADR-0005 protecting them from it. The sentence
 * is `endingNote`'s and the number is `settledPrice`'s, reached through the
 * same function settlement reaches it through — so what the chain is worth
 * here is what settlement will actually pay on it.
 */
const props = defineProps<{
  /** Every Entry this fan holds this Season, newest first. */
  entries: CommittedEntry[];
  /** The server's clock when it answered, which the countdowns start from. */
  answeredAt: string | null;
}>();

const emit = defineEmits<{ cancelled: [] }>();

const now = useNow(props.answeredAt);
const { refresh } = useBalance();

/** The Entry a request is in flight for, so only its button says so. */
const cancelling = ref("");
const problem = ref("");
const done = ref("");

/**
 * Each Entry with what it is worth and whether it can still be taken back.
 *
 * Every Prediction is repriced against how its Bout ended before any of that is
 * worked out: a No Result contributes ×1.0, and so does a Question a
 * disqualification never settled (ADR-0005), so a chain part-way through a
 * card is shown what it is now riding on rather than what it was priced at on
 * the day.
 */
const held = computed(() =>
  props.entries.map((entry) => {
    const { multipliers, returns } = entryAsItStands(entry);

    return {
      entry,
      predictions: entry.predictions.map((prediction, at) => ({
        prediction,
        multiplier: multipliers[at]!,
        note: endingNote(prediction, prediction.ending),
      })),
      returns,
      cancellation: cancellationOf(entry, now.value),
    };
  }),
);

/**
 * Takes the Entry back.
 *
 * The refusal shown is the server's own sentence: the card may have moved
 * between this page rendering and the button being pressed, and only the
 * server knows that.
 */
async function cancel(entryId: string) {
  cancelling.value = entryId;
  problem.value = "";
  done.value = "";

  try {
    const { message } = await $fetch(`/api/predictions/entries/${entryId}/cancel`, {
      method: "POST",
    });

    done.value = message;

    // The Coins came back the moment that answered, so the header is wrong
    // until it is told — and the listing still shows the Entry as open.
    await refresh();
    emit("cancelled");
  } catch (failure) {
    problem.value = problemFrom(failure);

    // Whatever refused it knows something this page did not, and every one of
    // those reasons is visible in the listing once it is re-read.
    emit("cancelled");
  } finally {
    cancelling.value = "";
  }
}
</script>

<template>
  <section>
    <h2 class="font-headline text-lg font-black italic uppercase">Your Entries</h2>

    <p class="mt-2 max-w-2xl text-sm text-on-surface/70 leading-relaxed">
      {{ CANCELLATION_MESSAGES.whileOpen }}
    </p>

    <p v-if="entries.length === 0" class="mt-6 text-sm text-on-surface/70">
      {{ CANCELLATION_MESSAGES.noneYet }}
    </p>

    <ol v-else class="mt-6 flex flex-col gap-4">
      <li
        v-for="{ entry, predictions, returns, cancellation } in held"
        :key="entry.id"
        class="border border-outline-variant/20 bg-surface-container-low p-6"
      >
        <div class="flex flex-wrap items-baseline justify-between gap-3">
          <p class="text-xs font-bold uppercase tracking-widest text-on-surface/60">
            {{ ENTRY_STATUS_LABELS[entry.status] }} ·
            <time :datetime="entry.submittedAt">{{ inTbilisi(entry.submittedAt) }}</time>
          </p>

          <p class="text-sm font-bold tabular-nums">
            {{ coinsLabel(entry.amount) }} at {{ multiplierLabel(returns.multiplier) }}
          </p>
        </div>

        <ol class="mt-4 flex flex-col gap-2">
          <li v-for="{ prediction, multiplier, note } in predictions" :key="prediction.boutId">
            <div class="flex items-baseline justify-between gap-3 text-sm">
              <span>
                <span class="text-xs font-bold uppercase tracking-widest text-on-surface/60">
                  Bout {{ prediction.cardOrder }}
                </span>
                — {{ outcomeLabel(prediction, prediction.corners) }}
              </span>
              <span class="shrink-0 font-bold tabular-nums">
                {{ multiplierLabel(multiplier) }}
              </span>
            </div>

            <p v-if="note" class="mt-1 text-xs text-on-surface/70 leading-relaxed">{{ note }}</p>
          </li>
        </ol>

        <p v-if="entry.status === 'open'" class="mt-4 text-sm">
          Returns
          <span class="font-headline font-black tabular-nums text-primary">
            {{ coinsLabel(returns.reward) }}
          </span>
          if every Prediction in it lands.
        </p>

        <p v-else-if="entry.status === 'cancelled'" class="mt-4 text-sm text-on-surface/70">
          {{ coinsLabel(entry.amount) }} returned.
        </p>

        <p
          v-else-if="entry.status === 'refunded'"
          class="mt-4 text-sm text-on-surface/70 leading-relaxed"
        >
          {{ coinsLabel(entry.amount) }} returned in full. No Bout in this Entry produced a result
          to grade, so there was nothing left for it to be right or wrong about.
        </p>

        <button
          v-if="cancellation.cancellable"
          type="button"
          :disabled="cancelling === entry.id"
          class="mt-4 border border-outline-variant/40 px-6 py-3 font-headline text-xs font-black uppercase tracking-widest disabled:opacity-60"
          @click="cancel(entry.id)"
        >
          {{ cancelling === entry.id ? "Cancelling…" : "Cancel Entry" }}
        </button>

        <p
          v-else-if="entry.status === 'open'"
          class="mt-4 text-sm text-on-surface/70 leading-relaxed"
        >
          {{ cancellation.reason }}
        </p>
      </li>
    </ol>

    <p v-if="problem" class="mt-4 text-sm text-error" role="alert">{{ problem }}</p>

    <p v-if="done" class="mt-4 text-sm text-primary" role="status">{{ done }}</p>
  </section>
</template>
