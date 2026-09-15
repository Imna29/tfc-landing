<script setup lang="ts">
import { STANDING_MESSAGES, type FanStanding } from "#shared/standings";

/**
 * Where a fan stands in the Season being played: what they hold, and where
 * that puts them.
 *
 * The top of the profile, and the answer to "how far am I from the top ten?" —
 * which is the question the leaderboard cannot answer for a fan sitting at
 * 340th. It is the same Rank the leaderboard shows, because it is the same
 * ordering of the same materialised Balance (`server/utils/standings.ts`).
 *
 * Rendered on the server, unlike the Balance in the site header. That one is
 * on every page including the edge-cached ones, so only the browser can fill
 * it in (see `useBalance`); `/profile` is exempt from the cache and
 * server-rendered per request (ADR-0008), so this arrives with the HTML.
 *
 * Between Seasons there is nothing here to state as a number. A fan then has
 * no Balance and no Rank at all, which is a different thing from holding no
 * Coins and from being last, and "0 Coins, unranked" would read as having lost
 * everything.
 */
defineProps<{ standing: FanStanding | null }>();
</script>

<template>
  <section v-if="standing" class="border border-outline-variant/20 bg-surface-container-low p-8">
    <template v-if="standing.season && standing.balance !== null">
      <p class="font-headline text-sm font-black uppercase tracking-widest text-on-surface/60">
        {{ standing.season.name }}
      </p>

      <p class="font-headline text-5xl font-black italic uppercase text-primary mt-2 tabular-nums">
        {{ standing.balance }}
      </p>

      <p class="mt-2 text-sm text-on-surface/70">
        {{ STANDING_MESSAGES.balance(standing.balance) }}
      </p>

      <p
        class="mt-6 border-t border-outline-variant/20 pt-6 text-sm leading-relaxed"
        :class="standing.rank === null ? 'text-on-surface/70' : ''"
      >
        {{
          standing.rank === null
            ? STANDING_MESSAGES.unranked
            : STANDING_MESSAGES.ranked(standing.rank, standing.fans)
        }}
      </p>
    </template>

    <p v-else class="max-w-xl text-sm text-on-surface/70 leading-relaxed">
      {{ STANDING_MESSAGES.noSeason }}
    </p>
  </section>
</template>
