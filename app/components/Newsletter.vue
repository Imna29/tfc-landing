<script setup lang="ts">
const email = defineModel<string>({ default: '' })

const handleSubmit = () => {
  if (email.value) {
    console.log('Newsletter signup:', email.value)
  }
}
</script>

<template>
  <section class="container mx-auto px-6 md:px-20 mb-24">
    <div class="bg-primary-container p-12 md:p-20 relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-12">
      <div class="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
        <div class="grid grid-cols-6 gap-2 rotate-12 -translate-y-20">
          <div class="h-96 w-4 bg-white" />
          <div class="h-96 w-4 bg-white" />
          <div class="h-96 w-4 bg-white" />
          <div class="h-96 w-4 bg-white" />
          <div class="h-96 w-4 bg-white" />
          <div class="h-96 w-4 bg-white" />
        </div>
      </div>

      <div class="relative z-10 text-center md:text-left">
        <h2 class="font-headline text-5xl md:text-7xl font-black italic uppercase text-white leading-none mb-4">
          Join The<br>Front Line
        </h2>
        <p class="text-white/80 font-bold uppercase tracking-widest">Get exclusive fighter content and ticket pre-sale codes.</p>
      </div>

      <div class="relative z-10 w-full max-w-md">
        <form class="flex flex-col gap-4" @submit.prevent="handleSubmit">
          <input
            v-model="email"
            type="email"
            placeholder="EMAIL ADDRESS"
            class="bg-transparent border-0 border-b-4 border-white text-white placeholder:text-white/50 font-black text-2xl py-4 focus:ring-0 focus:border-white uppercase"
          >
          <button type="submit" class="bg-white text-primary-container py-5 font-black uppercase text-xl hover:bg-on-surface-variant transition-colors">
            Sign Up Now
          </button>
        </form>
      </div>
    </div>
  </section>
</template>