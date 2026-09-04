<script setup lang="ts">
/**
 * A TFC Coin.
 *
 * The coin itself, from `redesign/tfc-coin-spritesheet.png`: the 48 frames of
 * one full turn, laid out in a single row as `public/tfc-coin-spin.png` and
 * shown one frame at a time. At rest it is the first of them, the obverse
 * face-on. The sheet arrives 8×6 at 320px a frame with the studio's dark
 * background baked in, so it is keyed to transparency, scaled to 80px and
 * strung out in one row — 32KB for the whole turn, which is what makes it
 * affordable in a site header.
 *
 * **Drawn rather than turned.** A coin can be spun in CSS by rotating one face
 * on `rotateY`, and it looks like what it is: a flat card with the same face
 * mirrored on its back, and no edge at all. These frames were rendered with
 * both faces, the milled edge and the light moving across them, and stepping
 * through them is the difference between a coin turning and a rectangle
 * flipping.
 *
 * It never moves by itself: a coin spinning in a header is a header that never
 * stops moving. A parent that wants a turn animates `background-position-x`
 * across the strip, a step a frame — `PlayTfcButton` is the one that does, on
 * hover, and carries the keyframes. `steps(48, jump-none)` is what lands on
 * whole frames: it takes both ends of the range, so the 48 values it stops at
 * are the 48 frames rather than 48 samples across them. Anybody who has asked for less motion is
 * given none, here rather than in each parent.
 *
 * **Sized by whoever places it**, in both directions: the frames are square
 * and the strip is scaled to 48 times the element's width, so a coin with no
 * height is a coin with nothing to show.
 */
</script>

<template>
  <span class="tfc-coin" aria-hidden="true" />
</template>

<style scoped>
.tfc-coin {
  display: inline-block;
  background-image: url("/tfc-coin-spin.png");
  background-repeat: no-repeat;
  /* 48 frames, each exactly as wide as the coin. */
  background-size: 4800% 100%;
  background-position: 0 0;
}

@media (prefers-reduced-motion: reduce) {
  .tfc-coin {
    animation: none !important;
    background-position: 0 0 !important;
  }
}
</style>
