<script setup lang="ts">
/**
 * The way between two pages that only make sense read together — what a
 * Season is played for, and who is allowed to play it.
 *
 * Its wording is navigation rather than copy, which is why it is here and not
 * in Prismic: these two pages have to be able to reach each other whatever the
 * content team has or has not written yet.
 */
defineProps<{ to: string; heading: string; label: string }>();
</script>

<template>
  <section class="px-6 md:px-20 py-24 bg-surface-container-low">
    <div class="max-w-[1440px] mx-auto flex flex-col items-start gap-6">
      <h2 class="font-headline text-3xl md:text-4xl font-black italic uppercase tracking-tighter">
        {{ heading }}
      </h2>
      <NuxtLink
        :to="to"
        class="inline-flex bg-primary-container text-white px-8 py-3 font-bold uppercase text-sm hover:scale-105 transition-transform active:scale-95"
      >
        {{ label }}
      </NuxtLink>
    </div>
  </section>
</template>
