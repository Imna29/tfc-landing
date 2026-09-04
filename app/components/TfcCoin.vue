<script setup lang="ts">
/**
 * A TFC Coin, as a mark rather than as a number.
 *
 * Both faces of `redesign/tfc-coin-faces.svg`, scaled into a 100×100 box: the
 * artwork is drawn at r=155 about an origin at the centre, so every coordinate
 * here is that one multiplied by 45/155 and moved to (50, 50). The obverse
 * carries TFC and the reverse carries COIN, exactly as the coin was struck, so
 * the mark on a button and the coin in the artwork are the one object.
 *
 * Inline rather than an `<img>` so it inherits its size from the class it is
 * given and so it can turn. Drawn rather than fetched, which is the point of
 * it being here: this appears in the site header of every marketing page, and
 * 1.1MB of sprite sheet is not a thing to put in a header for a decoration.
 *
 * **Two faces rather than one turning through itself.** A single face spun on
 * `rotateY` shows its own back — the lettering mirrored — for half of every
 * turn. So the reverse is really here, behind the obverse and turned away from
 * the reader, and each face hides its own back: a turn shows TFC, then the
 * edge, then COIN, which is what a flipped coin does.
 *
 * It never moves by itself: a coin spinning in a header is a header that never
 * stops moving. What it offers instead is somewhere to hang a turn — the disc
 * carries `tfc-coin__face`, and a parent that wants one animates that class.
 * The PlayTFC button is the one that does. Deliberately an animation there
 * rather than a transition here: a transition to a turned state unwinds when
 * the pointer leaves, and a coin that spins backwards out of a hover is worse
 * than one that does not spin.
 */
</script>

<template>
  <span class="tfc-coin" aria-hidden="true">
    <span class="tfc-coin__face">
      <svg viewBox="0 0 100 100" class="tfc-coin__side" focusable="false">
        <circle cx="54.6" cy="55.8" r="45" fill="#B06800" />
        <circle cx="50" cy="50" r="45" fill="#F8CA15" stroke="#040707" stroke-width="2" />
        <circle cx="50" cy="50" r="32.5" fill="#EFC00E" stroke="#D3A007" stroke-width="0.9" />
        <text
          x="50.9"
          y="58.4"
          text-anchor="middle"
          font-family="'Helvetica Neue', Helvetica, Arial, sans-serif"
          font-weight="700"
          font-size="20.3"
          letter-spacing="0.6"
          fill="#FCE76E"
          opacity="0.8"
        >
          TFC
        </text>
        <text
          x="50"
          y="57.3"
          text-anchor="middle"
          font-family="'Helvetica Neue', Helvetica, Arial, sans-serif"
          font-weight="700"
          font-size="20.3"
          letter-spacing="0.6"
          fill="#A96300"
        >
          TFC
        </text>
        <path
          d="M 13.7 36.8 A 38.6 38.6 0 0 1 56.7 12"
          fill="none"
          stroke="#FCE76E"
          stroke-width="5.2"
          stroke-linecap="round"
          opacity="0.9"
        />
        <ellipse
          cx="23.9"
          cy="22.4"
          rx="4.6"
          ry="2.6"
          fill="#FFF6C8"
          opacity="0.85"
          transform="rotate(-35 23.9 22.4)"
        />
        <circle cx="34" cy="15.7" r="1.7" fill="#FFF6C8" opacity="0.85" />
      </svg>

      <svg viewBox="0 0 100 100" class="tfc-coin__side tfc-coin__side--reverse" focusable="false">
        <circle cx="54.6" cy="55.8" r="45" fill="#B06800" />
        <circle cx="50" cy="50" r="45" fill="#F8CA15" stroke="#040707" stroke-width="2" />
        <circle cx="50" cy="50" r="32.5" fill="#EFC00E" stroke="#D3A007" stroke-width="0.9" />
        <text
          x="50.9"
          y="57.3"
          text-anchor="middle"
          font-family="'Helvetica Neue', Helvetica, Arial, sans-serif"
          font-weight="700"
          font-size="16.8"
          letter-spacing="0.6"
          fill="#FCE76E"
          opacity="0.8"
        >
          COIN
        </text>
        <text
          x="50"
          y="56.1"
          text-anchor="middle"
          font-family="'Helvetica Neue', Helvetica, Arial, sans-serif"
          font-weight="700"
          font-size="16.8"
          letter-spacing="0.6"
          fill="#A96300"
        >
          COIN
        </text>
        <path
          d="M 13.7 36.8 A 38.6 38.6 0 0 1 56.7 12"
          fill="none"
          stroke="#FCE76E"
          stroke-width="5.2"
          stroke-linecap="round"
          opacity="0.9"
        />
        <ellipse
          cx="23.9"
          cy="22.4"
          rx="4.6"
          ry="2.6"
          fill="#FFF6C8"
          opacity="0.85"
          transform="rotate(-35 23.9 22.4)"
        />
        <circle cx="34" cy="15.7" r="1.7" fill="#FFF6C8" opacity="0.85" />
      </svg>
    </span>
  </span>
</template>

<style scoped>
.tfc-coin {
  display: inline-block;
  perspective: 220px;
}

.tfc-coin__face {
  position: relative;
  display: block;
  width: 100%;
  height: 100%;
  transform-style: preserve-3d;
}

.tfc-coin__side {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  backface-visibility: hidden;
}

.tfc-coin__side--reverse {
  transform: rotateY(180deg);
}

@media (prefers-reduced-motion: reduce) {
  .tfc-coin__face {
    animation: none !important;
    transform: none !important;
  }
}
</style>
