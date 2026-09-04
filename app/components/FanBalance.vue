<script setup lang="ts">
import { coinsLabel } from "#shared/coins";

/**
 * What the signed-in fan has to work with, in the game's header.
 *
 * Renders nothing until the browser has an answer — see {@link useBalance} for
 * why it is never rendered on the server. The server and the first client
 * render therefore agree that there is nothing here, and the Balance appears
 * on the tick after hydration rather than as a mismatch.
 *
 * Nothing at all is shown when no Season is open: a fan then has no Balance,
 * which is a different thing from holding no Coins, and "0 Coins" would read
 * as having run out.
 *
 * The coin beside the number is the mark from `TfcCoin`, so a Balance reads as
 * Coins at a glance rather than as one more number in a header.
 *
 * There is a root element either way, so whatever the header hands down — a
 * class, a handler — has somewhere to land whether or not there is a Balance
 * to show. `display` is set inline on the empty one rather than through a
 * class, so that a `display` arriving from the header cannot bring it back.
 *
 * `data-fan-balance` is on both, and is how `test/server/coins.test.ts` tells
 * "the header carries a Balance the browser fills in" from "nobody ever added
 * one" — which are otherwise the same HTML, and one of them is an acceptance
 * criterion.
 */
const { balance, load } = useBalance();

onMounted(load);
</script>

<template>
  <NuxtLink
    v-if="balance !== null"
    to="/profile"
    data-fan-balance
    class="inline-flex items-center gap-2 border border-outline-variant/30 px-3 py-1.5 hover:border-primary transition-colors"
  >
    <TfcCoin class="w-[18px] h-[18px] shrink-0" />
    <span class="font-headline text-sm font-black uppercase tracking-widest tabular-nums">
      {{ coinsLabel(balance) }}
    </span>
  </NuxtLink>
  <span v-else data-fan-balance style="display: none" aria-hidden="true" />
</template>
