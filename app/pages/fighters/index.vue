<script setup lang="ts">
useHead({
  title: 'Fighters | Tbilisi Fighting Championship',
})

interface Fighter {
  id: string
  name: string
  nickname: string
  record: string
  division: string
  image: string
  badges: { type: 'champion' | 'undefeated' | 'contender'; label: string }[]
}

const fighters: Fighter[] = [
  {
    id: 'luka-gorgasali',
    name: 'Luka Gorgasali',
    nickname: 'The Georgian Ghost',
    record: '18 — 1 — 0',
    division: 'Lightweight',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuB3kikdKAXEQ6VV1xZB_iQbOqyisG1mBlMdZuTjnmksArOAXL1yeMLzq7MkWYf9s5Hpm69rpWpsvnyrWuqLrali4r-p4E3zO5ROPQ3-8iRWvSq7qgFM5mQbVz5L3muE35waXfBLEhXgmsiIHxshK0_uC8U8esN7uvat--dBRXVCT0rgG-09oSTatrc6CFk9QVPszLt2P-n5krWDoSgt_qqPf3Lzyahb9KBgkSZW-TCZIMZGWNdfBGszXhHSKtpi0J3uNXr2KEDSf0A',
    badges: [
      { type: 'champion', label: 'CHAMPION' },
      { type: 'contender', label: '#1 POUND-FOR-POUND' },
    ],
  },
  {
    id: 'nikoloz-kvirikadze',
    name: 'Nikoloz Kvirikadze',
    nickname: 'Iron Heart',
    record: '12 — 2 — 0',
    division: 'Welterweight',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBi3eYBiSywrovG5AZsBZ-3qcuGomF_MSEcV_sWkkZ8o8Jzlx6lj_VBzaFi9W6rPDX6NQDMSb-4ArBNZcZ_7G1qBuPYRRfzMRhI10Yc9MzvzlAIrod90wgPeWTDnxoYWieGdlWrXM8Qc_VQvwUHc5f_ln3SKsDmBGvR6d__dHoldhkhJ4FOjtHCNIUJf3b35aEgtvR_2x0e1ifthG4eBErwS6nTb5sJe7hUSbgYxHM_O49rutgjUMZSnwFVuffUoYq3XyDgelYO_nI',
    badges: [{ type: 'contender', label: 'TOP CONTENDER' }],
  },
  {
    id: 'giga-beridze',
    name: 'Giga Beridze',
    nickname: 'The Tsar',
    record: '9 — 0 — 0',
    division: 'Middleweight',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuA2N81Fk3qujdHGbOadEq-ZHfdIAS5tZwcKQHURz0VDl_0_824elG8AxKQtZG2O4Za4kwgV5p3UXwe2FlVVLYF8DYMdOpBl2TQNyQAxbkGDT9xR3fmo1k7g6FOoE-D3ID1fHGFvtDm7TB4HdT6D8ArdVB8R-8PO_RQcDKV3-u7_AAPnCCLrNo7CnfwjPCE9C0bbvhfXwtjt0T9kSKLbNLmek2h_m4AC9TGo0ELAnY7SRcngaIS-Uo4MS7idNu1OStkaKZa3T7vAKV4',
    badges: [{ type: 'undefeated', label: 'UNDEFEATED' }],
  },
  {
    id: 'ira-kobaladze',
    name: 'Ira Kobaladze',
    nickname: 'Black Sea Shark',
    record: '15 — 4 — 1',
    division: 'Light Heavyweight',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuC7sgAWoYy2uhb7b8nRbBHPg3dWZB-FS2nANapZ35dveTGJs0H4ME0wWRVrNKAndAciVhTLj99oHTyY0bASjdzeSpwkUZYUgXH0XvziKsQTVqSDfwxs2cIPI1AZcvhTd5iix606ImNmcVvmy6iNJf97XZhUOMvHwLt4CSKVYDMcCmRp4qqCgAM1On7OPzneFAOWtY5HnB-qOolRN7qw82oBoUf1r14EzUONu9Zm3xhNd51ARcaq5aqkVUvs9Va_XHR0O1v-8pCXOPg',
    badges: [],
  },
  {
    id: 'zurab-tavadze',
    name: 'Zurab Tavadze',
    nickname: 'Mtivari Massive',
    record: '21 — 7 — 0',
    division: 'Heavyweight',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuB_gPw-6j7Y9XdIG0s2LyVGaejtjYalOboj1TCxYYFekMHet-pOQ6NXRXfsG1yp5mnzFBWvU4YjmNUiHg4Ms6Bif2aaqedf64VV6afNv1m60nag60rNveMrcNAziqEwd0_inAqTgnkLlR21vtyK9Ab_2RmBhZpYj0M1sQXOnQ9VkKL9LuW6If2YigaD595pmgvgAatiWYwVHQqWD6XPX5hQCJiqURa512nrv-L5L9GyzMTUCs2jqI7tJk-J-zclip88SBqyJWUwD30',
    badges: [],
  },
  {
    id: 'rezi-makashvili',
    name: 'Rezi Makashvili',
    nickname: 'The Sniper',
    record: '7 — 1 — 0',
    division: 'Bantamweight',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDp7anxtZ55BCLiU9gzZqXyL_xkcUtbvoGglrk4GsOnYQS-lFeNZ_do3FAv0SKFvBp50CKKHN39lMHYqTDjCBqT9ge9d45lDR797bIz_WrZXndf8pXBAVXHMJYEbHU38EPb66w736O9wgU_BVtAuNMHyEjvRx-2T4S_IC9nRam9RD6K97fWOfATwT0JFTQnFNW9TLcCHvpB_dRqxo1jOVoJ3ZkwbHAF3SQgqE0wm77CZgnwmcxwj5syilBizKHP0YbSLmWTmRyByAI',
    badges: [],
  },
]

const divisions = ['All Divisions', 'Heavyweight', 'Light Heavyweight', 'Middleweight', 'Welterweight', 'Lightweight']
const selectedDivision = ref('All Divisions')

const searchQuery = ref('')

const filteredFighters = computed(() => {
  let result = fighters
  if (selectedDivision.value !== 'All Divisions') {
    result = result.filter(f => f.division === selectedDivision.value)
  }
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(f => 
      f.name.toLowerCase().includes(query) || 
      f.nickname.toLowerCase().includes(query)
    )
  }
  return result
})
</script>

<template>
  <main class="pt-32 pb-20">
    <section class="px-8 mb-16 max-w-7xl mx-auto">
      <div class="flex flex-col md:flex-row md:items-end justify-between gap-8 border-b border-outline-variant pb-12">
        <div>
          <h1 class="text-6xl md:text-8xl font-headline font-black italic tracking-tighter uppercase leading-none mb-4">
            Elite <span class="text-primary-container">Warriors</span>
          </h1>
          <p class="text-secondary font-body max-w-md uppercase tracking-widest text-sm font-light">
            The roster of Tbilisi Fighting Championship. Athletes forged in iron, competing for the crown of the Caucasus.
          </p>
        </div>
        <div class="relative w-full md:w-96">
          <Icon name="material-symbols:search" class="absolute left-4 top-1/2 -translate-y-1/2 text-outline" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="FIND A FIGHTER..."
            class="w-full bg-surface-container-lowest border-b-2 border-outline-variant focus:border-primary px-12 py-4 font-headline italic font-bold tracking-tight outline-none placeholder:text-outline-variant uppercase"
          >
        </div>
      </div>
    </section>

    <section class="px-8 mb-12 max-w-7xl mx-auto overflow-x-auto">
      <div class="flex space-x-4 pb-4">
        <button
          v-for="division in divisions"
          :key="division"
          class="px-8 py-3 font-headline font-black italic tracking-tighter uppercase whitespace-nowrap transition-colors"
          :class="selectedDivision === division
            ? 'bg-primary-container text-white'
            : 'bg-surface-container-low text-on-surface hover:bg-surface-container-high'"
          @click="selectedDivision = division"
        >
          {{ division }}
        </button>
      </div>
    </section>

    <section class="px-8 max-w-7xl mx-auto">
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-12">
        <NuxtLink
          v-for="fighter in filteredFighters"
          :key="fighter.id"
          :to="`/fighters/${fighter.id}`"
          class="group relative fighter-card-skew bg-surface-container-low overflow-hidden hover:scale-[1.02] transition-transform duration-500"
        >
          <div class="h-[500px] relative">
            <img
              :alt="fighter.name"
              class="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700"
              :src="fighter.image"
            >
            <div class="absolute inset-0 bg-gradient-to-t from-surface-container-lowest via-transparent to-transparent opacity-90" />
            <div v-if="fighter.badges.length > 0" class="absolute top-6 left-6 flex flex-col items-start gap-2">
              <template v-for="badge in fighter.badges" :key="badge.label">
                <span
                  v-if="badge.type === 'champion'"
                  class="bg-primary-container text-white text-[10px] font-black italic tracking-tighter px-3 py-1 uppercase"
                >
                  {{ badge.label }}
                </span>
                <span
                  v-else="badge.type === 'contender' || badge.type === 'undefeated'"
                  class="bg-white/10 backdrop-blur-md text-white text-[10px] font-bold tracking-widest px-3 py-1 uppercase"
                >
                  {{ badge.label }}
                </span>
              </template>
            </div>
            <div class="absolute bottom-6 left-6 right-6">
              <p class="text-primary font-headline italic font-black text-xl mb-1 uppercase tracking-tight">"{{ fighter.nickname.toUpperCase() }}"</p>
              <h3 class="text-4xl font-headline font-black italic uppercase leading-none tracking-tighter mb-4">{{ fighter.name }}</h3>
              <div class="flex justify-between items-center border-t border-white/10 pt-4">
                <div>
                  <p class="text-[10px] text-outline uppercase tracking-widest font-bold">RECORD</p>
                  <p class="text-2xl font-headline font-black italic text-on-surface tracking-tighter">{{ fighter.record }}</p>
                </div>
                <div class="text-right">
                  <p class="text-[10px] text-outline uppercase tracking-widest font-bold">DIVISION</p>
                  <p class="text-lg font-headline font-black italic text-secondary tracking-tighter uppercase">{{ fighter.division }}</p>
                </div>
              </div>
            </div>
          </div>
        </NuxtLink>
      </div>

      <div class="mt-20 flex justify-center">
        <button class="group flex items-center gap-4 bg-surface-container-high border border-outline-variant px-12 py-6 font-headline font-black italic tracking-tighter uppercase hover:bg-primary-container hover:text-white transition-all duration-300">
          Load More Fighters
          <Icon name="material-symbols:keyboard-double-arrow-right" class="group-hover:translate-x-2 transition-transform" />
        </button>
      </div>
    </section>
  </main>
</template>

<style scoped>
.fighter-card-skew {
  clip-path: polygon(0 0, 100% 0, 100% 90%, 90% 100%, 0 100%);
}
</style>