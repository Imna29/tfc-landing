<script setup lang="ts">
import {
  STANDING_MESSAGES,
  rankLabel,
  whereYouStand,
  type Leaderboard,
  type StandingsWords,
} from "#shared/standings";

/**
 * The top ten of a Season, and the row of the fan reading it.
 *
 * The one page where fans see each other, so the only thing it shows of
 * anybody is the username they chose (ADR-0007). There is no column here a
 * real name could travel in, and nothing upstream that would send one.
 *
 * **A fan outside the top ten is pinned below it, at their true Rank.** That
 * is the whole reason this page can be read by somebody sitting at 340th: a
 * leaderboard a fan can never appear on stops being motivating after one
 * event. A fan inside the top ten is marked in it instead of being shown a
 * second time, which `Leaderboard` makes structural rather than something this
 * has to remember — the pinned row is only ever a row the ten do not hold.
 *
 * `whereYouStand` decides between the four different things an empty `you`
 * means, because the sentence under the table is a different one each time.
 *
 * **Two pages, one table.** The Season being played and a Season that has
 * finished are the same rows in the same order, and everything that differs
 * between them is a sentence — so `words` is the vocabulary and this is the
 * markup. `LEADERBOARD_MESSAGES` is the present tense, `FINAL_STANDINGS_MESSAGES`
 * the past. The `standings` type is the shape both answer in, `FinalStandings`
 * being a `Leaderboard` whose Season is never null.
 *
 * Rendered on the server, which is what the page's exemption from the edge
 * cache is spent on (ADR-0008): a row filled in by the browser afterwards
 * would be paying that cost for nothing.
 */
const props = defineProps<{
  standings: Leaderboard;
  signedIn: boolean;
  /**
   * What this table says about itself, which is what tells the two apart.
   *
   * Required rather than defaulting to the leaderboard's: a page of standings
   * that did not say which Season it was a page of would read as the one being
   * played, and a Season that finished would quietly invite fans to climb it.
   */
  words: StandingsWords;
}>();

/** The fan's own place: the row to pin, and what to say about it. */
const standing = computed(() => whereYouStand(props.standings, props.signedIn, props.words));
</script>

<template>
  <section>
    <template v-if="standings.season">
      <p class="font-headline text-sm font-black uppercase tracking-widest text-on-surface/60">
        {{ standings.season.name }}
      </p>

      <p class="mt-2 max-w-2xl text-sm text-on-surface/70 leading-relaxed">
        {{ words.what }}
      </p>

      <div v-if="standings.top.length > 0" class="mt-8 overflow-x-auto">
        <table class="w-full border-collapse text-left">
          <thead>
            <tr
              class="border-b border-outline-variant/20 font-headline text-xs font-black uppercase tracking-widest text-on-surface/60"
            >
              <th scope="col" class="py-3 pr-4">Rank</th>
              <th scope="col" class="py-3 pr-4">Fan</th>
              <th scope="col" class="py-3 pr-4 text-right">Balance</th>
              <th scope="col" class="py-3 text-right">Entries played</th>
            </tr>
          </thead>

          <tbody>
            <tr
              v-for="place in standings.top"
              :key="place.rank"
              class="border-b border-outline-variant/10"
              :class="place.you ? 'bg-primary-container/10' : ''"
            >
              <td class="py-4 pr-4 font-headline font-black tabular-nums">
                {{ rankLabel(place.rank) }}
              </td>
              <th scope="row" class="py-4 pr-4 font-normal">
                {{ place.username }}
                <!-- Said in a word as well as in a colour, so that the row a
                     fan is looking for is findable without seeing one. -->
                <span
                  v-if="place.you"
                  class="ml-2 bg-primary-container px-2 py-1 font-headline text-xs font-black uppercase tracking-widest text-white"
                >
                  You
                </span>
              </th>
              <td class="py-4 pr-4 text-right tabular-nums">{{ place.balance }}</td>
              <td class="py-4 text-right tabular-nums">{{ place.entriesPlayed }}</td>
            </tr>
          </tbody>

          <!--
            The fan's own row, below the ten and under a heading of its own: it
            is not eleventh place, it is wherever in the Season they actually
            are, and a row that carried on the table's own numbering would read
            as one.
          -->
          <tbody v-if="standing.pinned" class="border-t-2 border-outline-variant/40">
            <tr>
              <th
                scope="rowgroup"
                colspan="4"
                class="pt-6 pb-2 font-headline text-xs font-black uppercase tracking-widest text-on-surface/60 text-left"
              >
                {{ words.yourRow }}
              </th>
            </tr>
            <tr class="bg-primary-container/10">
              <td class="py-4 pr-4 font-headline font-black tabular-nums">
                {{ rankLabel(standing.pinned.rank) }}
              </td>
              <th scope="row" class="py-4 pr-4 font-normal">{{ standing.pinned.username }}</th>
              <td class="py-4 pr-4 text-right tabular-nums">{{ standing.pinned.balance }}</td>
              <td class="py-4 text-right tabular-nums">{{ standing.pinned.entriesPlayed }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <p v-else class="mt-8 max-w-xl text-sm text-on-surface/70 leading-relaxed">
        {{ words.nobodyYet }}
      </p>

      <p v-if="standing.note" class="mt-6 max-w-xl text-sm text-on-surface/80 leading-relaxed">
        {{ standing.note }}
      </p>
    </template>

    <p v-else class="max-w-xl text-sm text-on-surface/70 leading-relaxed">
      {{ STANDING_MESSAGES.noSeason }}
    </p>
  </section>
</template>
