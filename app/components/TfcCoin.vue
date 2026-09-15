<script setup lang="ts">
/**
 * A TFC Coin.
 *
 * The coin itself, from `redesign/tfc-coin-spritesheet.png`: the 48 frames of
 * one full turn, laid out in a single row as `public/tfc-coin-spin.png` and
 * shown one frame at a time. Frame 0 is the obverse face-on, frame 24 the
 * reverse — half a turn — and a 49th frame repeats the first, so a full turn
 * ends where it began and the arithmetic lands on whole frames: with the strip
 * scaled to 49 times the coin, frame *k* sits at `100k/48`% and the two that
 * matter are 0% and 50%.
 *
 * The sheet arrives 8×6 at 320px a frame with the studio's dark background
 * baked in, so it is keyed to transparency, scaled to 80px and strung out in
 * one row — 32KB for the whole turn, which is what makes it affordable in a
 * site header.
 *
 * **And each frame is re-centred on the face before it goes in.** The frames
 * arrive centred on the coin's outline, which is correct for a coin turning
 * about its own axis and wrong for one this thick: the lit face swings a tenth
 * of the coin's width to one side, snaps across as the coin passes edge-on,
 * and the eye — which is watching the face, not the outline — reads all of
 * that as a coin sliding sideways. Aligning the faces instead leaves the dark
 * rim to do the swinging, and the coin turns where it stands.
 *
 * **Drawn rather than turned.** A coin can be spun in CSS by rotating one face
 * on `rotateY`, and it looks like what it is: a flat card with the same face
 * mirrored on its back, and no edge at all. These frames were rendered with
 * both faces, the milled edge and the light moving across them, and stepping
 * through them is the difference between a coin turning and a rectangle
 * flipping.
 *
 * It does not move by itself. A parent that wants it to animates
 * `background-position-x` across the strip, a step a frame: `PlayTfcButton` is
 * the one that does — turning at rest, and half a turn onto the reverse when a
 * pointer arrives — and it carries the keyframes. Every other coin on the site
 * is a mark beside a number, and a number with something spinning next to it
 * is harder to read.
 *
 * Anybody who has asked for less motion is given none, and that is settled
 * here rather than in each parent: the rule below outranks whatever a parent
 * asks for.
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
  /* 49 frames, each exactly as wide as the coin. */
  background-size: 4900% 100%;
  background-position: 0 0;
}

@media (prefers-reduced-motion: reduce) {
  .tfc-coin {
    animation: none !important;
    background-position: 0 0 !important;
  }
}
</style>
