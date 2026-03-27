<script setup lang="ts">
useHead({
  title: "About | TFC — Tbilisi Fighting Championship",
});

interface Leader {
  id: string;
  name: string;
  role: string;
  title: string;
  image: string;
  offset: number;
}

const leaders: Leader[] = [
  {
    id: "luka-beridze",
    name: "Luka Beridze",
    role: "Founder & CEO",
    title: "Global Operations",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDudO_szMGo1MAWstLply6vrwyBBun8shKYnNGS-FpyQXGqfVzd1yjP06hi1dmwjY9bSWarFmeJRID_guhK6_BHbINbeumjH3U7ZSM4l4QKWr2lqGDVPLICBwvX-Itv2EphLYOUyn84amI9Wk1H99CZEhED6udA370RyVVl-i6uz7mrMBTg9KvsvRJJyXxDmqTWfrlLuPLRACvgaSGG-Jgeadbozr55g0IL81nLCLMY0bMReor8Wx0qbn4Is6yiEQddKO7p4BS7IYM",
    offset: 0,
  },
  {
    id: "nika-gvasalia",
    name: "Nika Gvasalia",
    role: "Sporting Director",
    title: "Matchmaking & Scouting",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBe7nVTILHHwexnwxTU_eaWihqZS9IirM9ikrz8nrGk4dyFBUVMGHQ_IAMZdbYaZ8hmy4nZ-EcH9guOZr8lIHFNZX6-0C65JELSJ2tu_h8hJ2a2j66Ksyw92d2S604EG2Zjci6RsXP59abMyytSt_X6apSr3Cd11N3KkPWwLbfQ54uslPdGKWO-baZjigRxMA-wSow8shR1B4HHgPhN96dvG3Z7xbis99Boz_V_fbMEMC9P-IWuwAtswKKPgwbyBj2VYrktSyKDvSM",
    offset: 12,
  },
  {
    id: "david-abashidze",
    name: "David Abashidze",
    role: "Creative Director",
    title: "Brand & Media Strategy",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDj7rdwusG5-eO-6UlyneQuxI86wwUVO3yo0S6qlzdF8D42lb_Dmb5jJJaLwxaDi33t11AhOMHlDgRhSh07iRuDwOL-TZWH1Hq43miNNNF1VzFOd0H8okdkQ6Xpa8xjIyJ1Sh8J7BkSfYF13DDmq9I_2I8DssEoAP9EL8DQndnTK_37PhaDZlT7v60F2I2qgC2JlVRymaNM2w2eVN-HiMfoIabEgyqkbYRdWsA5piQ8j7JQyhBowjS8zB69MhMr_X3x9wGbVwLSvyY",
    offset: 24,
  },
];

const communityImages = [
  {
    src: "https://lh3.googleusercontent.com/aida-public/AB6AXuB2zage4gPOUTGTlx-sAZfDCIYYIYsswaS2AmV1H8Ssj0simiEcML-BXy-j_yImiLEXrWKXMjhRB2k-MM3e6ZICDjX23USIL05cJMMpMEJtPAAuo3mXqP1YVluZpkR-NaJoRbFsYD3_7FKjSXu1tpr1_qSJXOX1rU5OWVtnuE92GGAPUSIyMXGFz7cg6ZyDCfQ7ntaqj1t_Hpm3i9ZUDQE4yZ5lm2j1tsWek6I8fknAOn7IZCt8giecYCsiab-rhce3P5YTXpxqwGQ",
    offset: false,
  },
  {
    src: "https://lh3.googleusercontent.com/aida-public/AB6AXuAL2rU9jIIFTJhFPgmkLmEoL8j5FS1M8kaGvgWBbrGEyIdt1eajhxUBDHdI6L-BxgJPtgdquVRFcSsrdUnv0u0sKPlBvwy0vaDrQaZrE0EEwtMjLY-zPftl8qR8NWEH8thdHxX4bZTT6aYl673Czsz1N67pEKyh4HWjr63J2dNMsfwGU-MaybOQ-7tVs62Zvz7rVtt3_JF7O8AK8KjtorNS93PUEBptfGm3gNnpCS5gHwIBQQ_Zgi194tcFr_SdKPC49l4b1qwPHhk",
    offset: true,
  },
];
</script>

<template>
  <main class="">
    <section class="relative h-[819px] flex items-end overflow-hidden">
      <div class="absolute inset-0 z-0">
        <img
          alt="Tbilisi Arena"
          class="w-full h-full object-cover"
          src="https://lh3.googleusercontent.com/aida-public/AB6AXuCwn5dbzVgUUT1YXAfm6CguszFSGUGZKej0eSOsGJDniN0FXrYShjC3VnKh5soj-_s06dHHLtJMzJoFLxKhNbJo_9-tQoFUbdDxdRK_JV5jyF8S_UhBZQV14IvOT5BWZByjBEKDEahmGC-jTYjyEt10129z9heGZdEA8wARhAHpF99L3jf2DPBijTgYNPnr8Db5HsESqy3nVtlOI3LsCad0fizT3g8yqi8s8Y_HjMJkosyLqHeSNkOtyu3EhD7fDK-NtGQjFHzMjuc"
        />
        <div class="absolute inset-0 hero-gradient" />
      </div>

      <div class="relative z-10 px-8 pb-16 max-w-7xl mx-auto w-full">
        <h1
          class="font-headline text-7xl md:text-9xl font-black italic uppercase leading-none tracking-tighter text-white"
        >
          THE BLOODLINE <br />
          OF <span class="text-primary-container">TBILISI</span>
        </h1>
        <div class="mt-8 flex items-center space-x-4">
          <div class="h-1 w-24 bg-primary-container" />
          <p class="font-headline text-xl uppercase tracking-widest italic text-secondary">
            Est. 2018 | Georgia
          </p>
        </div>
      </div>
    </section>

    <section class="py-32 px-8 bg-surface-dim">
      <div class="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
        <div class="space-y-8">
          <h2 class="font-headline text-5xl font-black italic uppercase tracking-tighter">
            OUR STORY
          </h2>
          <div class="space-y-6 text-on-surface/80 leading-relaxed text-lg">
            <p>
              Tbilisi has always been a city of warriors. From the ancient fortifications on the
              Mtkvari river to the modern arenas of today, combat is etched into the very stones of
              this capital. Tbilisi Fighting Championship (TFC) was born from this legacy.
            </p>
            <p>
              Founded in 2018, TFC set out to capture the raw energy of Georgian wrestling, boxing,
              and mixed martial arts, elevating it to a world-class broadcast stage. We don't just
              host fights; we curate the next chapter of a thousand-year-old warrior culture.
            </p>
          </div>
          <div class="flex items-center space-x-12 pt-8">
            <div>
              <span class="block text-4xl font-headline font-black italic text-primary-container"
                >50+</span
              >
              <span class="text-xs uppercase tracking-widest text-secondary">Major Events</span>
            </div>
            <div>
              <span class="block text-4xl font-headline font-black italic text-primary-container"
                >200+</span
              >
              <span class="text-xs uppercase tracking-widest text-secondary">Ranked Athletes</span>
            </div>
          </div>
        </div>

        <div class="relative">
          <div class="absolute -top-4 -left-4 w-full h-full border-2 border-primary-container/20" />
          <img
            class="relative z-10 w-full grayscale contrast-125"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuDMK64SAS2vwOmhOM13g4hxIN_LegoOefkuKfpz3EnBcroiA4IOQDe7SyImodG9B9q82RhWlNAESkuvD78NK3z0dveDNEJRMkbmxT1y6w313N4VAFC9UEhzergs0PwQ_qH2QSr6p_Al9wkNoQlJkOUHFTb2QZprnnPw7DjAmCsfrkRpzgY8yUtmMM-u9gnMLS6HZ6Hg6OHm_l4bhbxLU5za18iIw6KqMMnOXPuDyI5231_LuDt22w4DShUaq7fUZ85e7wxRUzGwuVU"
          />
        </div>
      </div>
    </section>

    <section class="py-24 px-8 bg-surface-container-lowest">
      <div class="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
        <div class="md:col-span-2 bg-surface-container-low p-12 relative overflow-hidden group">
          <div
            class="absolute top-0 right-0 w-32 h-32 bg-primary-container/10 skew-box translate-x-10 -translate-y-10"
          />
          <h3 class="font-headline text-4xl font-black italic uppercase mb-6">OUR MISSION</h3>
          <p class="text-xl leading-relaxed text-on-surface/90">
            To provide a premier global platform for elite combat athletes, merging traditional
            Caucasian fighting spirit with cutting-edge sports entertainment and cinematic
            production value.
          </p>
        </div>

        <div class="bg-primary-container p-12 flex flex-col justify-end">
          <Icon name="material-symbols:bolt" class="text-6xl mb-6" />
          <h3 class="font-headline text-3xl font-black italic uppercase">VELOCITY</h3>
          <p class="text-white/80">
            Accelerating the careers of local talent to the global top-tier.
          </p>
        </div>

        <div class="bg-surface-container-highest p-12">
          <h3 class="font-headline text-3xl font-black italic uppercase mb-4">THE VISION</h3>
          <p class="text-on-surface/80">
            Defining Tbilisi as the absolute combat capital of Eurasia by 2030.
          </p>
        </div>

        <div class="md:col-span-2 bg-surface-container-low p-12 relative overflow-hidden">
          <div class="flex items-center gap-8">
            <div class="flex-1">
              <h3 class="font-headline text-4xl font-black italic uppercase mb-4">INTEGRITY</h3>
              <p class="text-on-surface/80">
                Unwavering standards in athlete safety, fair matchmaking, and sporting excellence.
                We honor the octagon as a sacred proving ground.
              </p>
            </div>
            <Icon name="material-symbols:shield" class="text-8xl text-outline-variant opacity-30" />
          </div>
        </div>
      </div>
    </section>

    <section class="py-32 px-8 overflow-hidden">
      <div class="max-w-7xl mx-auto flex flex-col md:flex-row items-center gap-16">
        <div class="w-full md:w-1/2 order-2 md:order-1">
          <div class="grid grid-cols-2 gap-4">
            <img
              class="w-full h-64 object-cover grayscale"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuB2zage4gPOUTGTlx-sAZfDCIYYIYsswaS2AmV1H8Ssj0simiEcML-BXy-j_yImiLEXrWKXMjhRB2k-MM3e6ZICDjX23USIL05cJMMpMEJtPAAuo3mXqP1YVluZpkR-NaJoRbFsYD3_7FKjSXu1tpr1_qSJXOX1rU5OWVtnuE92GGAPUSIyMXGFz7cg6ZyDCfQ7ntaqj1t_Hpm3i9ZUDQE4yZ5lm2j1tsWek6I8fknAOn7IZCt8giecYCsiab-rhce3P5YTXpxqwGQ"
            />
            <img
              class="w-full h-80 object-cover grayscale translate-y-8"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuAL2rU9jIIFTJhFPgmkLmEoL8j5FS1M8kaGvgWBbrGEyIdt1eajhxUBDHdI6L-BxgJPtgdquVRFcSsrdUnv0u0sKPlBvwy0vaDrQaZrE0EEwtMjLY-zPftl8qR8NWEH8thdHxX4bZTT6aYl673Czsz1N67pEKyh4HWjr63J2dNMsfwGU-MaybOQ-7tVs62Zvz7rVtt3_JF7O8AK8KjtorNS93PUEBptfGm3gNnpCS5gHwIBQQ_Zgi194tcFr_SdKPC49l4b1qwPHhk"
            />
          </div>
        </div>

        <div class="w-full md:w-1/2 order-1 md:order-2 space-y-8">
          <h2 class="font-headline text-5xl font-black italic uppercase tracking-tighter">
            TBILISI CULTURE
          </h2>
          <div class="w-20 h-2 bg-primary-container" />
          <p class="text-lg text-on-surface/80 leading-relaxed italic">
            "TFC is more than a promotion; it's a heartbeat. We work with local gyms in Saburtalo
            and Gldani to ensure the roots of Georgian combat are nurtured. Our community
            initiatives provide scholarships for rising stars who embody the spirit of Tbilisi."
          </p>
          <button
            class="flex items-center space-x-4 text-primary font-headline font-black italic uppercase group"
          >
            <span>Read our Community Impact Report</span>
            <Icon
              name="material-symbols:arrow-right-alt"
              class="group-hover:translate-x-2 transition-transform"
            />
          </button>
        </div>
      </div>
    </section>

    <section class="py-32 px-8 bg-surface-container-low">
      <div class="max-w-7xl mx-auto">
        <h2
          class="font-headline text-5xl font-black italic uppercase tracking-tighter mb-20 text-center"
        >
          THE ARCHITECTS
        </h2>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-12">
          <div
            v-for="leader in leaders"
            :key="leader.id"
            class="space-y-6 text-center md:text-left"
            :style="{ transform: `translateY(${leader.offset}px)` }"
          >
            <div
              class="aspect-[3/4] bg-surface-container-highest overflow-hidden relative grayscale hover:grayscale-0 transition-all duration-500"
            >
              <img class="w-full h-full object-cover" :src="leader.image" />
              <div
                class="absolute bottom-0 left-0 p-6 bg-gradient-to-t from-black to-transparent w-full"
              >
                <p
                  class="text-primary font-headline font-black italic uppercase tracking-widest text-sm"
                >
                  {{ leader.role }}
                </p>
              </div>
            </div>
            <h4 class="font-headline text-2xl font-black italic uppercase">{{ leader.name }}</h4>
            <p class="text-on-surface-variant text-sm uppercase tracking-widest">
              {{ leader.title }}
            </p>
          </div>
        </div>
      </div>
    </section>

    <section class="py-40 px-8 text-center bg-surface-container-lowest relative overflow-hidden">
      <div class="absolute inset-0 opacity-10 pointer-events-none">
        <div class="grid grid-cols-6 gap-2 rotate-12 scale-150">
          <div class="h-20 bg-primary-container" />
          <div class="h-20" />
          <div class="h-20 bg-primary-container" />
          <div class="h-20" />
          <div class="h-20 bg-primary-container" />
          <div class="h-20" />
        </div>
      </div>

      <div class="relative z-10 max-w-4xl mx-auto">
        <h2
          class="font-headline text-6xl md:text-8xl font-black italic uppercase tracking-tighter mb-10 leading-none"
        >
          WITNESS THE <br /><span class="text-primary-container">EVOLUTION</span>
        </h2>
        <p class="text-xl text-secondary mb-12 uppercase tracking-widest">
          Join us at the edge of the cage. Become part of the legacy.
        </p>
        <div class="flex flex-col md:flex-row items-center justify-center gap-6">
          <button
            class="w-full md:w-auto bg-primary-container text-white px-12 py-5 font-headline font-black italic uppercase tracking-tighter text-xl hover:scale-105 transition-all"
          >
            TICKETS FOR NEXT EVENT
          </button>
          <NuxtLink
            to="/contact"
            class="w-full md:w-auto border-2 border-outline text-white px-12 py-5 font-headline font-black italic uppercase tracking-tighter text-xl hover:bg-white hover:text-black transition-all text-center"
          >
            PARTNER WITH US
          </NuxtLink>
        </div>
      </div>
    </section>
  </main>
</template>

<style scoped>
.skew-box {
  clip-path: polygon(10% 0, 100% 0, 90% 100%, 0 100%);
}
.hero-gradient {
  background: linear-gradient(to bottom, rgba(19, 19, 19, 0) 0%, rgba(19, 19, 19, 1) 100%);
}
</style>
