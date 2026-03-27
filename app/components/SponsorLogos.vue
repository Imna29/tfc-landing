<script setup lang="ts">
const sponsors = ['TITAN', 'VULCAN', 'APEX', 'IRON', 'CORE']
</script>

<template>
  <section class="py-12 border-t border-outline-variant/10">
    <div class="container mx-auto px-6 md:px-20">
      <p class="text-center text-[10px] font-bold uppercase tracking-[0.3em] text-on-surface-variant mb-12">Official Partners</p>
      <div class="flex flex-wrap justify-center items-center gap-12 md:gap-24 opacity-30 grayscale hover:grayscale-0 transition-all">
        <span
          v-for="sponsor in sponsors"
          :key="sponsor"
          class="font-headline font-black text-3xl italic uppercase"
        >
          {{ sponsor }}
        </span>
      </div>
    </div>
  </section>
</template>