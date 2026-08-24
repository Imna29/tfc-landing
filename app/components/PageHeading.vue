<script setup lang="ts">
defineProps<{ text: string }>();
</script>

<template>
  <header class="px-6 md:px-20 pt-24 pb-12">
    <div class="max-w-[1440px] mx-auto">
      <h1 class="font-headline text-5xl md:text-7xl font-black italic uppercase tracking-tighter">
        {{ text }}
      </h1>
    </div>
  </header>
</template>
