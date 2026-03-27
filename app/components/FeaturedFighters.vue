<script setup lang="ts">
interface Fighter {
  id: string
  name: string
  nickname: string
  record: string
  rank: string
  reach: string
  age: number
  image: string
}

const fighters: Fighter[] = [
  {
    id: 'mamuka',
    name: 'Mamuka',
    nickname: 'The Georgian Lion',
    record: '18-2',
    rank: 'C',
    reach: '74"',
    age: 28,
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDOmVi64Z1G4Gy5mKKxwRn8nPfqeGNjOcvfLq3lp-lbO7xtw8BH62IKKPXCRLphDc8IRkTE-j-L8w9B2GUj1xHtb-DaUHtm2vciORXA9nLyj5XLLMBrGNa5lzDRVS5ww7emyuR9JqgzPBseYLseXWeRbCuawvv9-XqQe0jQoqrwXlXJeBikD03jagxk8HlojQ1_yX9ZbJ3bt5xQqBvNz6JSglvUGiNemnzdFOkLtCL34eWf5kKfL22DdzfiH6cm9iXy8JA0ad83EKY',
  },
  {
    id: 'ilia',
    name: 'Ilia',
    nickname: 'Shadow Strike',
    record: '14-0',
    rank: '#2',
    reach: '71"',
    age: 24,
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuA2mOfpfS_7ZDNx5_h8pRxb5-gUx4oL6CIADn3hW6yr_97ccnLrC0J6Pa-1FqA8ejI9sQxd8b6TeWZ-GVr2Gr6PpvpCzadfEU5O2X9uwFVFaYR2Li3OQQTflRdFBtK2AJ-af-CWAH90FCaceO5gf0OoBRNu7H1SBTbBj5duuX4yd8Px3U78s9EAL7-JeGwn7d2fn3yewyMWOWSXcQ6iYQ2C8Agh_JdKmRTcxJwZO4qkqTSe3L_iMlNerpNHapLZBgmqrXAv15OFRLc',
  },
  {
    id: 'levan',
    name: 'Levan',
    nickname: 'Iron Grip',
    record: '22-5',
    rank: '#5',
    reach: '76"',
    age: 31,
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCtRBk4YxEyaHMp_VxGWSbPuvUU4WAgbc7rIo2zkLJl3m5PzLDEqQV57Z9zirYCX2sLkz6MEjURkO4cGKi25rvcSFNyjoTUoaXJ0xFmZUx6Kd6ZrQK-_BEmsU_ClHK3xrbnljCzGkgSCpIwR7ajvK5wkWevyGM5TP9gAsldLRY6pljOKmIaT5FqTYMSHtXawhnM9AhUGUiFzd7XKDbs2VX7tY0sKLtXPJPW6qsnnF9PZS-QpOC5d8Qqz5TpklLskuM_e2iw7A8O-0c',
  },
]
</script>

<template>
  <section class="py-24 px-6 md:px-20 container mx-auto">
    <div class="flex justify-between items-end mb-16">
      <div>
        <p class="text-primary font-black uppercase tracking-widest mb-2">The Elite</p>
        <h2 class="font-headline text-6xl font-black italic uppercase tracking-tighter">Featured Fighters</h2>
      </div>
      <NuxtLink to="/rankings" class="hidden md:flex items-center gap-2 font-bold uppercase tracking-widest text-on-surface-variant hover:text-primary transition-colors">
        View Rankings
        <Icon name="material-symbols:trending-up" />
      </NuxtLink>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-10">
      <article
        v-for="(fighter, index) in fighters"
        :key="fighter.id"
        class="group relative bg-surface-container-low overflow-hidden"
        :class="{ 'mt-8 md:mt-0': index === 0 || index === 2 }"
      >
        <div class="aspect-[3/4] overflow-hidden clip-slanted">
          <img
            :alt="fighter.name"
            class="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500 scale-105 group-hover:scale-100"
            :src="fighter.image"
          >
        </div>
        <div class="p-8">
          <div class="flex justify-between items-start mb-6">
            <div>
              <h3 class="font-headline text-3xl font-black italic uppercase leading-none">{{ fighter.name }}</h3>
              <p class="text-primary font-bold uppercase text-xs mt-1">'{{ fighter.nickname }}'</p>
            </div>
            <div class="text-right">
              <p class="text-2xl font-black italic">{{ fighter.record }}</p>
              <p class="text-[10px] uppercase font-bold text-on-surface-variant">Record</p>
            </div>
          </div>
          <div class="grid grid-cols-3 gap-2">
            <div class="text-center bg-background py-2">
              <p class="text-xs uppercase font-bold text-on-surface-variant">Rank</p>
              <p class="font-black text-lg">{{ fighter.rank }}</p>
            </div>
            <div class="text-center bg-background py-2">
              <p class="text-xs uppercase font-bold text-on-surface-variant">Reach</p>
              <p class="font-black text-lg">{{ fighter.reach }}</p>
            </div>
            <div class="text-center bg-background py-2">
              <p class="text-xs uppercase font-bold text-on-surface-variant">Age</p>
              <p class="font-black text-lg">{{ fighter.age }}</p>
            </div>
          </div>
        </div>
      </article>
    </div>
  </section>
</template>

<style scoped>
.clip-slanted {
  clip-path: polygon(0 0, 100% 0, 100% 85%, 0% 100%);
}
</style>