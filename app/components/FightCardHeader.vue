<script setup lang="ts">
import type { FightCard } from "#shared/fightCard";

/**
 * The card a fan has arrived to play, across the top of the page: what the game
 * is for, which Event it is, and when and where it is fought.
 *
 * The line above the Event's name says what a fan gets out of playing rather
 * than naming the section they are already in — they arrived through PlayTFC and
 * the header above still says so, and a strip that spends its first line
 * repeating that is a strip with nothing to tell them. It is the one sentence on
 * the page about the point of the thing, which is why it is up here in red and
 * not a paragraph further down that nobody reaches.
 *
 * Everything under it is a fact about the Event, and nothing in the strip moves.
 * It used to carry two numbers that did — a countdown to the first Lock, and how
 * many Bouts had been answered — and both are gone: a fan reads a card to weigh
 * up answers, and a clock they cannot act on plus a bar counting their own
 * clicks are two things standing between them and the first Bout. Where a Bout
 * stands is said on the Bout, which is where they are looking.
 */
defineProps<{ card: FightCard }>();
</script>

<template>
  <header class="border-b border-outline-variant/15 bg-surface-container-lowest">
    <div class="max-w-[1440px] mx-auto px-6 md:px-20 py-8 md:py-10">
      <p class="font-headline text-xs font-black uppercase tracking-[0.2em] text-primary">
        Collect Coins &amp; Climb Leaderboard
      </p>

      <h1
        class="mt-2 font-headline text-4xl md:text-6xl font-black italic uppercase tracking-tighter leading-none"
      >
        {{ card.title }}
      </h1>

      <!--
        Three facts in one line, and the rules between them are what make it
        one line rather than three things that happen to be near each other.
        They are decoration: a screen reader reads the three in turn either
        way, and "pipe" between each pair is noise.
      -->
      <p
        class="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-bold uppercase tracking-widest text-on-surface/60"
      >
        <time :datetime="card.scheduledStart" class="text-on-surface">
          {{ inTbilisi(card.scheduledStart) }}
        </time>
        <span class="text-on-surface/25" aria-hidden="true">|</span>
        <span>{{ card.venue }}</span>
        <span class="text-on-surface/25" aria-hidden="true">|</span>
        <span>{{ card.bouts.length }} {{ card.bouts.length === 1 ? "Bout" : "Bouts" }}</span>
      </p>
    </div>
  </header>
</template>
