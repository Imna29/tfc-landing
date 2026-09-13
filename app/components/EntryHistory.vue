<script setup lang="ts">
import { ENTRY_STATUSES, ENTRY_STATUS_LABELS } from "#shared/entries";
import { HISTORY_MESSAGES, openAndFinished, type FanHistory } from "#shared/history";

/**
 * Everything a fan has ever committed, in the two halves they came for.
 *
 * The listing My Predictions is made of. Above the line is what a fan is still
 * riding on — the chains that can still go either way, which is what somebody
 * opening this page mid-card is looking for; below it is the record, back
 * through every Season, with every Prediction of every chain graded against how
 * its Bout actually ended. `openAndFinished` in `shared/history.ts` draws the
 * line, and it draws it once: an Entry is on one side or the other, never both,
 * because a fan reading one chain in two places is a fan counting it twice.
 *
 * `SubmittedEntries` beside the card is the other listing of a fan's Entries
 * and is deliberately still there. It answers a different question — which of
 * these can I still take back — and it can only be asked where the reason to
 * ask it is, which is the card a fighter just withdrew from. Nothing here can
 * be cancelled, so nothing here reads a Lock.
 *
 * None of the numbers here are read back from anything stored. What each chain
 * came to and what it returned are worked out from the Predictions and the
 * Results by `readEntry`, which reaches the same functions settlement pays on
 * (ADR-0020) — so a Reward shown here is the Reward that was credited, not a
 * second opinion about it. Each Entry is drawn by `ReadEntry`, once, so the two
 * listings cannot come to draw the same Entry differently.
 *
 * The filter is the page's, not this component's: it is in the URL, so it
 * survives a reload and the back button, and the server renders the filtered
 * page rather than the browser filtering one it was already sent. This asks for
 * a change and the page navigates.
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

/** The Entries in the two halves the page is laid out in. */
const entries = computed(() => openAndFinished(props.history.entries));

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

/**
 * Whether to say that nothing is still open, rather than leave the half out.
 *
 * Only where the emptiness is a fact about the fan. A status filter is the fan
 * having asked for one kind of Entry, and answering "nothing of yours is still
 * open" under a listing of their wins would be the page blaming them for their
 * own filter — so the half is simply not drawn.
 */
const noneOpen = computed(() => nothingToShow.value === "" && props.history.filter.status === null);
</script>

<template>
  <section>
    <p class="max-w-2xl text-sm text-on-surface/70 leading-relaxed">
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

    <!--
      What the fan is still riding on, first and on its own. Flat rather than
      grouped by Season because every Open Entry is in the Season being played:
      a Season will not close while a Bout on one of its Events is still open.
    -->
    <section v-if="entries.open.length > 0 || noneOpen" class="mt-10">
      <h2 class="font-headline text-lg font-black italic uppercase">
        {{ HISTORY_MESSAGES.stillOpen }}
      </h2>

      <p v-if="entries.open.length === 0" class="mt-4 max-w-2xl text-sm text-on-surface/70">
        {{ HISTORY_MESSAGES.noneOpen }}
      </p>

      <ol v-else class="mt-4 flex flex-col gap-4">
        <ReadEntry v-for="read in entries.open" :key="read.entry.id" :read="read" />
      </ol>
    </section>

    <!--
      And the record underneath, which is kept forever. Grouped by Season so
      that four Seasons of Entries are four headings rather than one listing
      the current one is somewhere inside.
    -->
    <section v-if="entries.finished.length > 0" class="mt-12">
      <h2 class="font-headline text-lg font-black italic uppercase">
        {{ HISTORY_MESSAGES.finished }}
      </h2>

      <div v-for="group in entries.finished" :key="group.season.id" class="mt-8">
        <h3 class="font-headline text-sm font-black uppercase tracking-widest text-on-surface/60">
          {{ group.season.name }}
        </h3>

        <ol class="mt-4 flex flex-col gap-4">
          <ReadEntry v-for="read in group.entries" :key="read.entry.id" :read="read" />
        </ol>
      </div>
    </section>
  </section>
</template>
