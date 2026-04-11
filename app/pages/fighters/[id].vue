<script setup lang="ts">
const route = useRoute();
const fighterId = route.params.id;

interface Fight {
  result: string;
  date: string;
  opponent: string;
  event: string;
  method: string;
  round: string;
}

interface FighterProfile {
  id: string;
  name: string;
  nickname: string;
  record: string;
  rank: string;
  division: string;
  image: string;
  stats: {
    strikingAccuracy: string;
    takedownAccuracy: string;
    takedownDefense: string;
  };
  physical: {
    height: string;
    reach: string;
    age: string;
    legReach: string;
  };
  bio: string[];
  fights: Fight[];
  gallery: { src: string; alt: string; large?: boolean }[];
}

const fighter: FighterProfile = {
  id: "ilya-topuria",
  name: "Ilya Topuria",
  nickname: "The Giant",
  record: "15 - 0 - 0",
  rank: "#1 C",
  division: "LIGHTWEIGHT DIVISION",
  image:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuCyUiZFh-LtOBKHHOT6dqPyhfivbTjrPtVusTpwSTR1kQZB12sntkQ0wfMhXN6xuj1mysmoEMtAj7VYV41rFoJgu2jqkE01Knfm9qJr2McQR2XLum94D977KAeymiFheFGu08tgKd5tJgoTQ0Nlh0yczkhcSa3dz8GfrC6VdBZeHYSkiQvGY-jEXvEiHqvwrATdlECptHLhSSheDM7QVq1RoMX4lHZmS2uhO7RWZOogL97y4ZIKAyHlicl7_4RY2v6am_lwrokmtpw",
  stats: {
    strikingAccuracy: "52%",
    takedownAccuracy: "68%",
    takedownDefense: "92%",
  },
  physical: {
    height: "5' 8\" (173 cm)",
    reach: "69.0 in",
    age: "27",
    legReach: "38.0 in",
  },
  bio: [
    "Born in the rugged landscapes of Georgia, Ilya carries the ancient spirit of the Caucasian warriors into the modern octagon. His journey from wrestling mats in Tbilisi to the pinnacle of global combat sports is a testament to unyielding grit.",
    "Known for surgical precision in his striking and a wrestling base that smothers the elite, Topuria has decimated the lightweight division. Off the canvas, he is a cultural icon, representing the fusion of traditional Georgian values with elite professional athleticism.",
  ],
  fights: [
    {
      result: "WIN",
      date: "FEB 2024",
      opponent: "Volkanovski",
      event: "TFC 298 — Main Event",
      method: "KO / TKO",
      round: "ROUND 2, 3:32",
    },
    {
      result: "WIN",
      date: "JUN 2023",
      opponent: "Josh Emmett",
      event: "TFC Fight Night",
      method: "U-DECISION",
      round: "5 ROUNDS, 5:00",
    },
    {
      result: "WIN",
      date: "DEC 2022",
      opponent: "Bryce Mitchell",
      event: "TFC 282",
      method: "SUBMISSION",
      round: "ROUND 2, 3:10",
    },
  ],
  gallery: [
    {
      src: "https://lh3.googleusercontent.com/aida-public/AB6AXuBCwxhvTHi0nO3f84iNy70PrZYX3PaLcV1ZqQUZjLAUZ4YecB3mVToGFSwlp4RBpWboJipzcDCRtl_Q87SyonjiQTHar-zs0VLg_pFST-D_iUW3AQ2c2EN8_j8GsGqFNzoQezx3enochW0xBwLbphU0N24E1o3l2vlLXnjUSgXy9_EFWy2c1gPdLOCxwwS1kMR9-ZK8d5fO_keLmiUHIWTxgIlMjQdP4yZRCYC7uln0gVnsmrwXA1VzxCAYUALDzqmQITYW_yI0d_0",
      alt: "Training Shot",
    },
    {
      src: "https://lh3.googleusercontent.com/aida-public/AB6AXuCiMDVbhJrPkNT39UcpVAJ8PwXjW5wVXYQZJzE7m94KAPjnWh4UjwdWSbombNAMGgbaPdcpYXqy6MNTH_Gdpl3FZVVCGfOw8eP1LDDtpxz4c2TrCn-PyyLbC2l5BG5ASv2M9Or2hxw3Ub203SsJLmlG90m9elhXsPIx7uylBjdfrzWHkf304_1wlCqAmNYJAYaujDbgaJyzlPST1O_n41T9JQfuhKWFfVvCNQocncsbdoOm-ByuqlNWilM9-DA45R11t0P65N2CJhA",
      alt: "Octagon Action",
      large: true,
    },
    {
      src: "https://lh3.googleusercontent.com/aida-public/AB6AXuDtu5hVYgIwiQOlgnpRSF-UAwTfXGXrm1R0_9Y9LCqYsM0Jr_c6eQuHogmYShqI5cKhkBGhiardwEgOyxEp7nPAMmIRkPCmqjaereAdKjgXocZkp39eFzizUWBM9YpGnW30NB_lrgXgqfGRBBaFFhbdpPfeu_eC9yKH51Btpw1OXCxABuHUT2la9y8ke7ymHTkFAZd419BVsubZOpmxGKWtHWOTiBotNGl_j82LmbZUjiX0hinlRJX_BvE3Ype3RjaW3H-1kCZSy8c",
      alt: "Pre-fight Focus",
    },
    {
      src: "https://lh3.googleusercontent.com/aida-public/AB6AXuDlEYROrF-5stM3h7kuGz5UIGRZ3zDwzyEoX6K6UO9kTKNZAxg6YihEEe_prVkIyBrAyAg2GLBB_B70QpmbqdkAgN9aGa6Bl2PjeKUioOIzxSA89y-0Zd5wDNtwjyKtq9IqAiQHvTHgsN0-jM-B04IPy9O2jMQAxRMT2MufcRmmYDW0XzhkHDRPQOy1nbr637S-PaEJ7KwWOmHajXhY_xwc-HyWz2iMhGM9JhqpwW97qSjQyrdnQ7HoFtOSVyfhECakY0c1zrpDuk4",
      alt: "Crowd Reaction",
    },
    {
      src: "https://lh3.googleusercontent.com/aida-public/AB6AXuACxAN5i5FfZo3LzXtaYVpfgiTNgLuoN49u-N8KOrhbZtz_UzEStPqcu3uA5cnHMU6YZcMqohQXX3kebjs_li42S_FUZSWLecYhxdjye85hjNMKa9PcWjSDsGc5NIivdcASGSUv-wtYpgSxBZ58T0PfKEmvlu7ZEB2DC6yLZK9_FCwFezo1l9sawuBtQoiE5CVp1wHgOHArbkaS6A8DWm9BuEj6dbngYXgk4rYVCr_G8u7QL4TWo4BHRmKKYqC_tQlK43DiqC6NxlQ",
      alt: "Fighter Portrait",
    },
  ],
};

useHead({
  title: `${fighter.name} | Tbilisi Fighting Championship`,
});
</script>

<template>
  <main class="pt-20">
    <section class="relative min-h-[870px] flex items-center overflow-hidden">
      <div class="absolute inset-0 z-0">
        <img
          :alt="fighter.name"
          loading="eager"
          decoding="async"
          fetchpriority="high"
          class="w-full h-full object-cover object-center grayscale contrast-125"
          :src="fighter.image"
        />
        <div class="absolute inset-0 hero-gradient" />
      </div>

      <div class="relative z-10 px-8 md:px-20 w-full max-w-7xl mx-auto">
        <div class="flex flex-col gap-2">
          <span class="text-primary font-headline font-bold tracking-[0.3em] uppercase">{{
            fighter.division
          }}</span>
          <h1
            class="text-7xl md:text-9xl font-headline font-black italic tracking-tighter leading-none text-white"
          >
            {{ fighter.name.split(" ")[0]!.toUpperCase() }} <br />
            <span class="text-primary-container">"{{ fighter.nickname.toUpperCase() }}"</span>
            <br />
            {{ fighter.name.split(" ")[1]?.toUpperCase() || "" }}
          </h1>
          <div class="flex items-baseline gap-6 mt-8">
            <div class="flex flex-col">
              <span class="text-secondary-fixed-dim text-xs font-bold uppercase tracking-widest"
                >RECORD</span
              >
              <span class="text-4xl font-headline font-black italic italic">{{
                fighter.record
              }}</span>
            </div>
            <div class="h-12 w-[2px] bg-primary-container rotate-12" />
            <div class="flex flex-col">
              <span class="text-secondary-fixed-dim text-xs font-bold uppercase tracking-widest"
                >RANK</span
              >
              <span class="text-4xl font-headline font-black italic italic">{{
                fighter.rank
              }}</span>
            </div>
          </div>
        </div>
      </div>

      <div
        class="absolute bottom-0 right-0 w-1/2 h-24 bg-primary-container slanted-mask opacity-20 transform translate-y-12 translate-x-12"
      />
    </section>

    <section class="px-8 py-24 max-w-7xl mx-auto">
      <div class="grid grid-cols-1 md:grid-cols-12 gap-6">
        <div class="md:col-span-4 bg-surface-container-low p-8 border-l-4 border-primary-container">
          <h3 class="font-headline font-black italic text-2xl mb-8 uppercase tracking-tighter">
            Physical Specs
          </h3>
          <div class="space-y-6">
            <div class="flex justify-between items-end border-b border-outline-variant/20 pb-2">
              <span class="text-secondary-fixed-dim uppercase text-sm font-bold tracking-widest"
                >Height</span
              >
              <span class="text-xl font-headline font-bold">{{ fighter.physical.height }}</span>
            </div>
            <div class="flex justify-between items-end border-b border-outline-variant/20 pb-2">
              <span class="text-secondary-fixed-dim uppercase text-sm font-bold tracking-widest"
                >Reach</span
              >
              <span class="text-xl font-headline font-bold">{{ fighter.physical.reach }}</span>
            </div>
            <div class="flex justify-between items-end border-b border-outline-variant/20 pb-2">
              <span class="text-secondary-fixed-dim uppercase text-sm font-bold tracking-widest"
                >Age</span
              >
              <span class="text-xl font-headline font-bold">{{ fighter.physical.age }}</span>
            </div>
            <div class="flex justify-between items-end border-b border-outline-variant/20 pb-2">
              <span class="text-secondary-fixed-dim uppercase text-sm font-bold tracking-widest"
                >Leg Reach</span
              >
              <span class="text-xl font-headline font-bold">{{ fighter.physical.legReach }}</span>
            </div>
          </div>
        </div>

        <div class="md:col-span-8 bg-surface-container-lowest p-8 md:p-12 relative overflow-hidden">
          <div class="absolute top-0 right-0 p-4 opacity-5 pointer-events-none select-none">
            <span class="text-[12rem] font-headline font-black italic leading-none">GEO</span>
          </div>
          <h3 class="font-headline font-black italic text-2xl mb-6 uppercase tracking-tighter">
            The Warrior's Path
          </h3>
          <div class="max-w-2xl">
            <p class="text-lg leading-relaxed text-on-surface-variant mb-6 italic">
              {{ fighter.bio[0] }}
            </p>
            <p class="text-on-surface-variant leading-relaxed">
              {{ fighter.bio[1] }}
            </p>
          </div>
          <div class="flex gap-4 mt-10">
            <a
              class="w-12 h-12 flex items-center justify-center bg-surface-container-high hover:bg-primary-container transition-colors group"
              href="#"
            >
              <Icon
                name="material-symbols:share"
                class="text-white group-hover:scale-110 transition-transform"
              />
            </a>
            <a
              class="w-12 h-12 flex items-center justify-center bg-surface-container-high hover:bg-primary-container transition-colors group"
              href="#"
            >
              <Icon name="material-symbols:video-library" class="text-white" />
            </a>
          </div>
        </div>

        <div class="md:col-span-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div
            class="bg-surface-container p-8 flex flex-col items-center justify-center text-center"
          >
            <span class="text-primary-container font-headline font-black text-5xl mb-2">{{
              fighter.stats.strikingAccuracy
            }}</span>
            <span class="text-secondary-fixed-dim text-xs font-bold uppercase tracking-[0.2em]"
              >Striking Accuracy</span
            >
          </div>
          <div
            class="bg-surface-container p-8 flex flex-col items-center justify-center text-center"
          >
            <span class="text-primary-container font-headline font-black text-5xl mb-2">{{
              fighter.stats.takedownAccuracy
            }}</span>
            <span class="text-secondary-fixed-dim text-xs font-bold uppercase tracking-[0.2em]"
              >Takedown Accuracy</span
            >
          </div>
          <div
            class="bg-surface-container p-8 flex flex-col items-center justify-center text-center"
          >
            <span class="text-primary-container font-headline font-black text-5xl mb-2">{{
              fighter.stats.takedownDefense
            }}</span>
            <span class="text-secondary-fixed-dim text-xs font-bold uppercase tracking-[0.2em]"
              >Takedown Defense</span
            >
          </div>
        </div>
      </div>
    </section>

    <section class="bg-surface-container-lowest py-24">
      <div class="px-8 max-w-7xl mx-auto">
        <div class="flex items-center justify-between mb-16">
          <h2 class="text-5xl font-headline font-black italic uppercase tracking-tighter">
            Recent Battles
          </h2>
          <div class="h-[2px] flex-1 bg-outline-variant/20 mx-8" />
          <span class="text-primary font-headline font-bold">ALL VICTORIES</span>
        </div>

        <div class="space-y-4">
          <div
            v-for="fight in fighter.fights"
            :key="fight.opponent"
            class="group flex flex-col md:flex-row items-center bg-surface-container-low hover:bg-surface-container-high transition-all p-6 relative overflow-hidden"
          >
            <div class="absolute left-0 top-0 bottom-0 w-2 bg-primary-container" />
            <div class="flex-1 flex items-center gap-8 mb-4 md:mb-0">
              <div class="text-center">
                <span class="block text-2xl font-headline font-black italic">{{
                  fight.result
                }}</span>
                <span class="text-[10px] uppercase font-bold text-secondary-fixed-dim">{{
                  fight.date
                }}</span>
              </div>
              <div>
                <h4 class="text-2xl font-headline font-black italic uppercase">
                  {{ fight.opponent }}
                </h4>
                <p class="text-sm text-on-surface-variant uppercase tracking-widest">
                  {{ fight.event }}
                </p>
              </div>
            </div>
            <div class="flex items-center gap-12">
              <div class="text-right">
                <span class="block font-bold text-primary italic">{{ fight.method }}</span>
                <span class="text-xs text-secondary-fixed-dim uppercase">{{ fight.round }}</span>
              </div>
              <button class="bg-white/5 p-3 group-hover:bg-primary-container transition-colors">
                <Icon
                  name="material-symbols:play-arrow"
                  class="text-white"
                  style="font-variation-settings: &quot;FILL&quot; 1"
                />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="py-24 px-8 max-w-7xl mx-auto">
      <h3 class="font-headline font-black italic text-4xl mb-12 uppercase tracking-tighter">
        Combat Archive
      </h3>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <template v-for="(image, index) in fighter.gallery" :key="image.alt">
          <div
            v-if="image.large"
            class="aspect-square bg-surface-container-high relative group overflow-hidden md:row-span-2 md:col-span-2"
          >
            <img
              :alt="image.alt"
              loading="lazy"
              decoding="async"
              fetchpriority="low"
              class="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-500 scale-110 group-hover:scale-100"
              :src="image.src"
            />
            <div
              class="absolute inset-0 bg-primary-container/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
            >
              <Icon name="material-symbols:fullscreen" class="text-6xl text-white" />
            </div>
          </div>
          <div
            v-else
            class="aspect-square bg-surface-container-high relative group overflow-hidden"
          >
            <img
              :alt="image.alt"
              loading="lazy"
              decoding="async"
              fetchpriority="low"
              class="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-500 scale-110 group-hover:scale-100"
              :src="image.src"
            />
            <div
              class="absolute inset-0 bg-primary-container/20 opacity-0 group-hover:opacity-100 transition-opacity"
            />
          </div>
        </template>
      </div>
    </section>

    <section class="bg-primary-container py-20 px-8 text-center relative overflow-hidden">
      <div class="absolute inset-0 opacity-10 pointer-events-none">
        <div class="grid grid-cols-6 h-full w-full">
          <div class="border-r border-on-primary" />
          <div class="border-r border-on-primary" />
          <div class="border-r border-on-primary" />
          <div class="border-r border-on-primary" />
          <div class="border-r border-on-primary" />
          <div class="border-r border-on-primary" />
        </div>
      </div>
      <div class="relative z-10 max-w-3xl mx-auto">
        <h2
          class="text-5xl md:text-7xl font-headline font-black italic uppercase tracking-tighter mb-8 leading-tight"
        >
          Witness the Next Title Defense
        </h2>
        <div class="flex flex-col md:flex-row gap-4 justify-center">
          <button
            class="bg-on-primary-container text-primary-container font-headline font-black italic px-12 py-4 uppercase text-xl hover:scale-105 transition-transform"
          >
            Get Tickets Now
          </button>
          <button
            class="border-2 border-on-primary-container text-on-primary-container font-headline font-black italic px-12 py-4 uppercase text-xl hover:bg-on-primary-container/10 transition-colors"
          >
            Fight Schedule
          </button>
        </div>
      </div>
    </section>
  </main>
</template>

<style scoped>
.hero-gradient {
  background:
    linear-gradient(to right, #131313 20%, transparent 60%),
    linear-gradient(to top, #131313 10%, transparent 40%);
}
.slanted-mask {
  clip-path: polygon(10% 0, 100% 0, 90% 100%, 0% 100%);
}
</style>
