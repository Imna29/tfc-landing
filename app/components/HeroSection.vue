<script setup lang="ts">
</script>

<template>
  <section class="relative min-h-[921px] flex items-center overflow-hidden">
    <div class="absolute inset-0 z-0">
      <div class="absolute inset-0 bg-gradient-to-r from-background via-background/60 to-transparent z-10" />
      <img
        alt="Hero Background"
        loading="eager"
        decoding="async"
        fetchpriority="high"
        class="w-full h-full object-cover grayscale opacity-60"
        src="https://lh3.googleusercontent.com/aida-public/AB6AXuBmB1ZJVG8a5eQ8V0GrHVWiHz9zZMUsf6PDhO1vj5xQHF_DvoOj3YQW8wNmWO08COccUnu_s1YqccLjjBld7aOTBW9f3m88Ai66P7FMYT7F_neXfUXetwpSLO_uqCM_xU0jDNkq_gZAgEun0h-l2qGiMi29RfIgo1qt3fbcUv4UivuueuZ9jB0NvPU_uqnfhZgpyRQTPC5620OHc_IwNoXVYfdj4LN-YN-EVpDjJboJiyflhpHousJWeRwKrQlHbO1n5JIX5Dkxc-A"
      >
    </div>

    <div class="container mx-auto px-6 md:px-20 relative z-20">
      <div class="max-w-4xl">
        <div class="inline-block bg-primary-container text-white px-4 py-1 mb-6 font-bold uppercase tracking-tighter">
          <span class="block">Live from Tbilisi Arena</span>
        </div>
        <h1 class="font-headline text-6xl md:text-9xl font-black italic uppercase leading-[0.9] tracking-tighter mb-8 text-white">
          Where<br>Warriors<br><span class="text-primary-container">Rise</span>
        </h1>
        <p class="text-xl md:text-2xl font-light text-on-surface-variant max-w-2xl mb-12 border-l-4 border-primary-container pl-6">
          Experience the raw intensity of the Caucasus' premier fighting organization. Elite strikers, world-class grapplers, one octagon.
        </p>
        <div class="flex flex-col sm:flex-row gap-4">
          <button class="bg-primary-container text-white px-10 py-5 font-black uppercase text-lg flex items-center justify-center gap-3 group">
            Buy Tickets
            <Icon name="material-symbols:confirmation-number" class="group-hover:translate-x-1 transition-transform" />
          </button>
          <button class="border-2 border-outline-variant/30 text-white px-10 py-5 font-black uppercase text-lg flex items-center justify-center gap-3 backdrop-blur-sm hover:bg-white/5 transition-colors">
            Watch Highlights
            <Icon name="material-symbols:play-circle" />
          </button>
        </div>
      </div>
    </div>

    <div class="absolute bottom-10 right-20 hidden lg:block">
      <div class="flex flex-col items-end gap-2 text-primary font-headline italic font-bold">
        <span class="text-6xl">OCT 24</span>
        <span class="text-xl tracking-widest">TBILISI ARENA</span>
      </div>
    </div>
  </section>
</template>
