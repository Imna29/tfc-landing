<script setup lang="ts">
import { coinsLabel } from "#shared/coins";
import { PLAY_TFC } from "~/utils/navigation";

/**
 * The way from the marketing site into the game.
 *
 * The marketing header is a straight line of rectangles — a logo, four
 * uppercase links, a red Contact button — and one more red rectangle in it
 * would be read as another link. So the coin hangs outside the button's box
 * and breaks that line, which is what an eye catches. The geometry is
 * `redesign/playtfc-button.html`: a 3px ink border, a 5px ink shadow the
 * button presses into, and the coin overhanging far enough to clear the edge.
 *
 * **A header that clips its overflow cuts the coin in half.** The overhang is
 * outside this element's box, so `overflow: hidden` or a scrolling row
 * anywhere above it takes the half that hangs out — which is the half doing
 * the work. The two shades below with no token behind them are the ink the
 * outline and the shadow are drawn in, and the red one shade up from the
 * button's own, for hover.
 *
 * **The one place the game appears on the marketing site** (see
 * `app/utils/navigation.ts`), which is why it is allowed to be this loud.
 *
 * A signed-in fan's Balance rides inside it, behind a hairline divider. It is
 * filled in by the browser and is absent from the HTML the server sends — the
 * marketing pages this sits on are edge-cached with a key that ignores
 * cookies, so a Balance rendered into one would be served to whoever asked
 * next (ADR-0008). {@link useBalance} is where that decision lives, and this
 * is one of the two places in the site that shows what it holds.
 *
 * It sizes itself. Below the width the header's navigation collapses at, the
 * border thins and the shadow shortens so the outline does not go chunky
 * against smaller text, and the Balance steps out of the way entirely on the
 * narrowest windows — where it is one thing too many in a bar that also holds
 * a logo and a menu. One button at every width rather than two hidden past
 * each other, because two would be two of them in the HTML and, with scoped
 * CSS setting `display`, occasionally both on screen at once.
 */
const { balance, load } = useBalance();

onMounted(load);
</script>

<template>
  <NuxtLink :to="PLAY_TFC.to" class="play-tfc">
    <TfcCoin class="play-tfc__coin" />
    <span>{{ PLAY_TFC.label }}</span>
    <span v-if="balance !== null" data-fan-balance class="play-tfc__balance">
      {{ coinsLabel(balance) }}
    </span>
    <!--
      Somewhere for a Balance to go, whether or not there is one to show — the
      marker `FanBalance` carries for the same reason, and what
      `test/server/coins.test.ts` reads to tell a header that fills a Balance
      in from a site that never heard of Coins.
    -->
    <span v-else data-fan-balance hidden />
  </NuxtLink>
</template>

<style scoped>
.play-tfc {
  position: relative;
  display: inline-flex;
  align-items: center;
  /* Pays for the coin's overhang, so the header's own gap is still a gap. */
  margin-left: 18px;
  padding: 11px 22px 11px 34px;
  background: var(--color-primary-container);
  color: #ffffff;
  font-family: "Arial Black", "Helvetica Neue", Helvetica, Arial, sans-serif;
  font-size: 16px;
  line-height: 1;
  letter-spacing: 0.2px;
  border: 3px solid #040707;
  box-shadow: 5px 5px 0 #040707;
  transition:
    transform 0.09s ease,
    box-shadow 0.09s ease,
    background 0.15s ease;
}

.play-tfc:hover {
  background: #e8262d;
}

.play-tfc:active {
  transform: translate(5px, 5px);
  box-shadow: 0 0 0 #040707;
}

.play-tfc:focus-visible {
  outline: 3px solid var(--color-coin);
  outline-offset: 5px;
}

.play-tfc__coin {
  position: absolute;
  left: -18px;
  top: 50%;
  width: 34px;
  height: 34px;
  transform: translateY(-50%);
  filter: drop-shadow(0 2px 0 rgba(4, 7, 7, 0.55));
  /* Turning, unhurried, so the one way into the game is the one thing in the
     header that moves. The 49th frame is the first one again, so the loop
     comes round rather than snapping back. */
  animation: tfc-coin-turn 2.8s steps(48) infinite;
}

/*
  A pointer turns it over. Half the strip rather than all of it — frame 0 to
  frame 24, which is the obverse to the reverse — and it stays there while the
  pointer does, which is what `forwards` is for: hovering PlayTFC shows the
  other side of the coin rather than spinning it back to where it was.
*/
.play-tfc:hover .play-tfc__coin {
  animation: tfc-coin-flip 0.35s steps(24) forwards;
}

@keyframes tfc-coin-turn {
  from {
    background-position-x: 0%;
  }

  to {
    background-position-x: 100%;
  }
}

@keyframes tfc-coin-flip {
  from {
    background-position-x: 0%;
  }

  to {
    background-position-x: 50%;
  }
}

.play-tfc__balance {
  display: inline-flex;
  align-items: center;
  margin-left: 14px;
  padding-left: 14px;
  border-left: 2px solid rgba(255, 255, 255, 0.32);
  font-size: 15px;
  letter-spacing: 0.4px;
}

@media (max-width: 900px) {
  .play-tfc {
    margin-left: 14px;
    padding: 9px 17px 9px 27px;
    font-size: 14px;
    border-width: 2px;
    box-shadow: 4px 4px 0 #040707;
  }

  .play-tfc:active {
    transform: translate(4px, 4px);
  }

  .play-tfc__coin {
    left: -14px;
    width: 28px;
    height: 28px;
  }
}

@media (max-width: 480px) {
  .play-tfc__balance {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .play-tfc {
    transition: none;
  }

  .play-tfc__coin,
  .play-tfc:hover .play-tfc__coin {
    animation: none;
  }
}
</style>
