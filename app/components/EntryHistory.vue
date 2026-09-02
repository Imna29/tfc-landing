<script setup lang="ts">
import { coinsLabel } from "#shared/coins";
import { ENTRY_STATUSES, ENTRY_STATUS_LABELS } from "#shared/entries";
import { HISTORY_MESSAGES, bySeason, type FanHistory, type RewardState } from "#shared/history";
import { multiplierLabel } from "#shared/predictions";
import { outcomeLabel } from "#shared/pricing";
import { PREDICTION_GRADE_LABELS } from "#shared/results";

/**
 * Everything a fan has ever committed, and how each part of it went.
 *
 * The thing a fan comes to their profile for. `SubmittedEntries` on the card
 * is the Entries they can still do something about; this is the record — back
 * through every Season, kept forever, with every Prediction of every chain
 * graded against how its Bout actually ended.
 *
 * **Every Prediction says where it stands, whatever the Entry did.** A chain
 * that is already Lost still shows the Bouts it has left and how the ones
 * already fought went, which is #14's promise kept where a fan can see it: "I
 * was one Bout away" is the most engaging sentence on this page, and an Entry
 * that collapsed to a single word would throw it away. It is also why the
 * grade beside each answer is a different word from the Entry's status where
 * it can be — "Still open" under a Lost Entry is exactly the state that would
 * otherwise look like the game having lost track.
 *
 * None of the numbers here are read back from anything stored. What the chain
 * came to and what it returned are worked out from the Predictions and the
 * Results by `readEntry`, which reaches the same functions settlement pays on
 * (ADR-0013) — so a Reward shown here is the Reward that was credited, not a
 * second opinion about it.
 *
 * The filter is the page's, not this component's: it is in the URL, so it
 * survives a reload and the back button, and the server renders the filtered
 * page rather than the browser filtering one it was already sent. This asks
 * for a change and the page navigates.
 *
 * Which is why the two controls say what they are showing with `selected` on
 * the options rather than a `value` on the select. A `value` is set by the
 * browser after hydration and never appears in the HTML, so a fan who arrived
 * on a filtered URL would read a listing of Won Entries under a control saying
 * "Every status" for as long as the page took to hydrate — and would read it
 * forever with no JavaScript at all.
 */
const props = defineProps<{ history: FanHistory }>();

const emit = defineEmits<{ ask: [{ season: string; status: string }] }>();

/** The Entries, grouped under the Season they were committed in. */
const seasons = computed(() => bySeason(props.history.entries));

/**
 * What the two controls are showing now, read back from what was answered.
 *
 * An empty string is "all of them" on both, because that is what the absence
 * of a query parameter reads as: the page drops an empty one rather than
 * spelling "every" out in the URL a fan arrives at.
 */
const showing = computed(() => ({
  season: props.history.filter.seasonId ?? "",
  status: props.history.filter.status ?? "",
}));

/** Asks for one control moved, leaving the other where the fan left it. */
function ask(change: { season?: string; status?: string }) {
  emit("ask", { ...showing.value, ...change });
}

/**
 * Why there is nothing to show, which is never the same reason twice.
 *
 * A fan who has never committed an Entry is being told how to start; a fan
 * whose filter matched nothing is being told about the filter, because
 * otherwise the two are the same empty page and only one of them is their
 * fault.
 */
const nothingToShow = computed(() => {
  const { seasons, entries, filter } = props.history;

  if (seasons.length === 0) return HISTORY_MESSAGES.noneYet;
  if (entries.length > 0) return "";
  if (filter.status) return HISTORY_MESSAGES.noneMatching(filter.status);
  if (filter.seasonId) return HISTORY_MESSAGES.noneThisSeason;

  return HISTORY_MESSAGES.noneAtAll;
});

/** How the Coins beside an Entry are coloured: paid, promised, or gone. */
const REWARD_TONE = {
  paid: "text-primary",
  returned: "text-on-surface",
  potential: "text-on-surface",
  none: "text-on-surface/60",
} as const satisfies Record<RewardState, string>;
</script>

<template>
  <section>
    <h2 class="font-headline text-lg font-black italic uppercase">Entry history</h2>

    <p class="mt-2 max-w-2xl text-sm text-on-surface/70 leading-relaxed">
      {{ HISTORY_MESSAGES.kept }}
    </p>

    <div v-if="history.seasons.length > 0" class="mt-6 flex flex-wrap gap-4">
      <label class="flex flex-col gap-1">
        <span class="font-headline text-xs font-black uppercase tracking-widest text-on-surface/60">
          Season
        </span>
        <select
          class="border border-outline-variant/40 bg-surface-container-low px-4 py-3 text-sm"
          @change="ask({ season: ($event.target as HTMLSelectElement).value })"
        >
          <option value="" :selected="showing.season === ''">
            {{ HISTORY_MESSAGES.everySeason }}
          </option>
          <option
            v-for="season in history.seasons"
            :key="season.id"
            :value="season.id"
            :selected="season.id === showing.season"
          >
            {{ season.name }}
          </option>
        </select>
      </label>

      <label class="flex flex-col gap-1">
        <span class="font-headline text-xs font-black uppercase tracking-widest text-on-surface/60">
          Status
        </span>
        <select
          class="border border-outline-variant/40 bg-surface-container-low px-4 py-3 text-sm"
          @change="ask({ status: ($event.target as HTMLSelectElement).value })"
        >
          <option value="" :selected="showing.status === ''">
            {{ HISTORY_MESSAGES.everyStatus }}
          </option>
          <option
            v-for="status in ENTRY_STATUSES"
            :key="status"
            :value="status"
            :selected="status === showing.status"
          >
            {{ ENTRY_STATUS_LABELS[status] }}
          </option>
        </select>
      </label>
    </div>

    <p v-if="nothingToShow" class="mt-6 max-w-2xl text-sm text-on-surface/70 leading-relaxed">
      {{ nothingToShow }}
    </p>

    <div v-for="group in seasons" :key="group.season.id" class="mt-10">
      <h3 class="font-headline text-sm font-black uppercase tracking-widest text-on-surface/60">
        {{ group.season.name }}
      </h3>

      <ol class="mt-4 flex flex-col gap-4">
        <li
          v-for="{ entry, predictions, returns, reward } in group.entries"
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

          <ol class="mt-4 flex flex-col gap-3">
            <li
              v-for="{ prediction, grade, multiplier, ending, note } in predictions"
              :key="prediction.boutId"
            >
              <div class="flex items-baseline justify-between gap-3 text-sm">
                <span>
                  <span class="text-xs font-bold uppercase tracking-widest text-on-surface/60">
                    {{ prediction.eventTitle }} · Bout {{ prediction.cardOrder }}
                  </span>
                  — {{ outcomeLabel(prediction, prediction.corners) }}
                </span>
                <span class="shrink-0 font-bold tabular-nums">{{
                  multiplierLabel(multiplier)
                }}</span>
              </div>

              <p class="mt-1 flex flex-wrap items-baseline gap-2 text-xs">
                <span
                  class="font-headline font-black uppercase tracking-widest"
                  :class="grade === 'correct' ? 'text-primary' : 'text-on-surface/60'"
                >
                  {{ PREDICTION_GRADE_LABELS[grade] }}
                </span>
                <span v-if="ending" class="text-on-surface/70">{{ ending }}</span>
              </p>

              <p v-if="note" class="mt-1 text-xs text-on-surface/70 leading-relaxed">{{ note }}</p>
            </li>
          </ol>

          <p class="mt-4 text-sm leading-relaxed" :class="REWARD_TONE[reward.state]">
            {{ reward.note }}
          </p>
        </li>
      </ol>
    </div>
  </section>
</template>
