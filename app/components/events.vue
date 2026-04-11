<script setup lang="ts">
useHead({
  title: "Events | TFC — Tbilisi Fighting Championship",
});

interface UpcomingEvent {
  id: string;
  eventNumber: string;
  title: string;
  date: string;
  location: string;
  venue: string;
  image: string;
  tags: string[];
  price: string;
}

interface PastEvent {
  id: string;
  name: string;
  date: string;
  result: string;
}

const upcomingEvents: UpcomingEvent[] = [
  {
    id: "tfc-43",
    eventNumber: "TFC 43",
    title: "SOPROMADZE VS GORGODZE",
    date: "NOV 12",
    location: "Batumi Arena, Georgia",
    venue: "Batumi Arena, Georgia",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDDC3noIuoUyHSZULQxsexoHlrzg9u-EbFZ8HGlKHx1g093e7RbcyaR_xmd5XqxWlYtfY2x6GIBKuLxDR7ZgkunPhQ7YNuJkc25yssJ6fKtr0jLj_BQ6orDHg4aOyesHfxJQNnhVzM2pVDwBufECbihmXy1S0FjnMXSU3Y0OKC0N3uFCQAXJyZ2EO6zWeoOQcPRibCe_1mFEpDuwQXY157CzVQ-iIpgJk1KbT2FAX77VLYMs0J1FDX65yKypq3A4nJ5N6F09HSv9fI",
    tags: ["Middleweight Title", "PPV"],
    price: "45",
  },
  {
    id: "tfc-44",
    eventNumber: "TFC 44",
    title: "MAKHARADZE VS SILVA",
    date: "DEC 05",
    location: "Black Sea Arena, Shekvetili",
    venue: "Black Sea Arena, Shekvetili",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuAekHIbK02BOpmX2KRwtX6ewwceNVgXZhW4x0C8n8_6P5nshh9bxnX_4IU7U-CsZ9fXXMcElhHhKUhgj0RA7gRVn1iFYhgAZsHWchdPfcx6vRVEvfZ6o8eYrUzez83X5IRDTp06zppL8d_Yb9xT6oxj6P9qLjMqZkEcTZM7CV15Ncpud-gOFA-jdEMI1Xis4YAOVW91EJIr3Q0hCRlk-Xm5HENJ_ZloKLhX5VrHyPApm5ZiEXT7_OQkacgcUwUDJ1g336mH5TgfsDo",
    tags: ["Lightweight Duel", "Fight Night"],
    price: "30",
  },
];

const pastEvents: PastEvent[] = [
  {
    id: "tfc-41",
    name: "TFC 41: Iron Will",
    date: "Aug 20, 2024",
    result: "Kapanadze def. Miller (KO)",
  },
  {
    id: "tfc-40",
    name: "TFC 40: Tbilisi Fury",
    date: "Jul 15, 2024",
    result: "Dvalishvili def. Santos (Sub)",
  },
  {
    id: "tfc-39",
    name: "TFC 39: Night of Valor",
    date: "Jun 02, 2024",
    result: "Abashidze def. Lee (Dec)",
  },
];

const mainEvent = {
  title: "TFC 42",
  subtitle: "TITAN BLOOD",
  date: "OCTOBER 24 / 21:00 GET",
  location: "TBILISI SPORTS PALACE",
  image:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuB04qzXL1T4fP9n8nAbfiGUdgwWZ6sgcOmnQnFoull3BCYM6qliwl7brk5kF4gMoPhGHxdWxe7STk5FDdWGG4ZkKtjv23Ak4uJdupKPvoG2HGAzSDF-RGwXaVPw6LM-qwrVruhMRv0XoGL3DO88nhZieeieFTXPFDv8zlrg2Xp214Pv9Dqv20dcPs3Q3MArTKdVc9eGUgy_1C25grY5akNvZZBu_yuPJZiidscwvT5FvThKJe8069K2dlyJhgF9aymiNzvw7jz0Qp8",
};
</script>

<template>
  <main class="">
    <section class="relative h-[870px] w-full overflow-hidden bg-surface-container-lowest">
      <div class="absolute inset-0 z-0">
        <img
          :alt="mainEvent.title"
          loading="eager"
          decoding="async"
          fetchpriority="high"
          class="w-full h-full object-cover opacity-60 grayscale hover:grayscale-0 transition-all duration-700"
          :src="mainEvent.image"
        />
        <div
          class="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent"
        />
        <div
          class="absolute inset-0 bg-gradient-to-r from-background/80 via-transparent to-transparent"
        />
      </div>

      <div class="relative z-10 h-full flex flex-col justify-end px-12 pb-24 max-w-7xl mx-auto">
        <div class="mb-4 flex items-center gap-4">
          <span
            class="bg-primary-container text-white px-3 py-1 font-headline font-black italic text-sm tracking-widest"
            >LIVE EVENT</span
          >
          <div class="h-[2px] w-24 bg-primary" />
        </div>
        <h1
          class="font-headline text-7xl md:text-9xl font-black italic uppercase tracking-tighter leading-[0.85] mb-6"
        >
          {{ mainEvent.title }}: <br />
          <span class="text-primary">{{ mainEvent.subtitle }}</span>
        </h1>
        <div class="flex flex-wrap items-center gap-12 mt-4">
          <div>
            <p class="text-secondary uppercase text-xs tracking-[0.2em] mb-1">DATE & TIME</p>
            <p class="font-headline font-bold text-2xl uppercase">{{ mainEvent.date }}</p>
          </div>
          <div>
            <p class="text-secondary uppercase text-xs tracking-[0.2em] mb-1">LOCATION</p>
            <p class="font-headline font-bold text-2xl uppercase">{{ mainEvent.location }}</p>
          </div>
          <div class="flex gap-4">
            <button
              class="bg-primary-container text-white px-10 py-4 font-headline font-black italic text-xl uppercase tracking-tighter hover:scale-105 transition-transform"
            >
              SECURE SEATS
            </button>
            <button
              class="border border-white/20 hover:bg-white/10 px-10 py-4 font-headline font-black italic text-xl uppercase tracking-tighter transition-all"
            >
              VIEW CARD
            </button>
          </div>
        </div>
      </div>
    </section>

    <section class="py-24 px-8 bg-surface-dim">
      <div class="max-w-7xl mx-auto">
        <div class="flex items-end justify-between mb-16 border-b border-outline-variant pb-8">
          <div>
            <h2 class="font-headline text-5xl font-black italic uppercase tracking-tighter">
              Upcoming Battles
            </h2>
            <p class="text-secondary mt-2 uppercase tracking-widest text-sm">
              The road to the championship continues
            </p>
          </div>
          <div class="hidden md:block">
            <span class="text-8xl font-black italic opacity-5 font-headline">CALENDAR</span>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-12">
          <article
            v-for="event in upcomingEvents"
            :key="event.id"
            class="group relative bg-surface-container-low p-8 flex flex-col md:flex-row gap-8 hover:bg-surface-container-high transition-colors"
          >
            <div class="w-full md:w-48 h-64 overflow-hidden relative">
              <img
                :alt="event.title"
                loading="lazy"
                decoding="async"
                fetchpriority="low"
                class="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500 scale-110 group-hover:scale-100"
                :src="event.image"
              />
              <div
                class="absolute top-0 left-0 bg-primary-container p-2 font-headline font-black italic text-xs"
              >
                {{ event.eventNumber }}
              </div>
            </div>
            <div class="flex-1 flex flex-col justify-between">
              <div>
                <div class="flex justify-between items-start mb-4">
                  <span class="text-primary font-headline font-black italic text-xl">{{
                    event.date
                  }}</span>
                  <Icon name="material-symbols:location-on" class="text-secondary text-xl" />
                </div>
                <h3
                  class="font-headline text-3xl font-black italic uppercase tracking-tighter mb-2"
                >
                  {{ event.title }}
                </h3>
                <p class="text-on-surface-variant text-sm uppercase tracking-wider mb-4">
                  {{ event.venue }}
                </p>
                <div class="flex gap-2">
                  <span
                    v-for="tag in event.tags"
                    :key="tag"
                    class="text-[10px] border border-outline-variant px-2 py-1 uppercase text-secondary"
                  >
                    {{ tag }}
                  </span>
                </div>
              </div>
              <button
                class="mt-8 w-full py-3 bg-white text-background font-headline font-black italic uppercase tracking-tighter hover:bg-primary hover:text-white transition-colors"
              >
                TICKETS FROM {{ event.price }}
              </button>
            </div>
          </article>
        </div>
      </div>
    </section>

    <section class="py-24 bg-surface-container-lowest">
      <div class="max-w-7xl mx-auto px-8">
        <div class="flex items-center gap-4 mb-12">
          <div class="bg-secondary-fixed diagonal-line" />
          <h2 class="font-headline text-4xl font-black italic uppercase tracking-tighter">
            Event Archive
          </h2>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr
                class="border-b border-outline-variant text-secondary uppercase text-[10px] tracking-[0.3em]"
              >
                <th class="py-6 px-4">Event</th>
                <th class="py-6 px-4">Date</th>
                <th class="py-6 px-4">Main Event Result</th>
                <th class="py-6 px-4 text-right">Coverage</th>
              </tr>
            </thead>
            <tbody class="font-headline font-bold text-lg uppercase italic">
              <tr
                v-for="event in pastEvents"
                :key="event.id"
                class="border-b border-outline-variant/30 hover:bg-surface-container-low transition-colors group"
              >
                <td class="py-8 px-4">{{ event.name }}</td>
                <td class="py-8 px-4 text-secondary text-sm font-body not-italic">
                  {{ event.date }}
                </td>
                <td class="py-8 px-4 text-primary">{{ event.result }}</td>
                <td class="py-8 px-4 text-right">
                  <a
                    class="inline-flex items-center gap-2 group-hover:text-primary transition-colors"
                    href="#"
                  >
                    REPLAY <Icon name="material-symbols:play-circle" class="text-sm" />
                  </a>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="mt-12 text-center">
          <button
            class="text-secondary font-headline font-bold italic uppercase tracking-widest hover:text-white transition-colors underline underline-offset-8"
          >
            Load More History
          </button>
        </div>
      </div>
    </section>

    <section class="py-24 bg-surface-dim overflow-hidden">
      <div class="max-w-7xl mx-auto px-8 grid grid-cols-1 lg:grid-cols-2 gap-0">
        <div class="bg-surface-container-low p-12 flex flex-col justify-center relative">
          <div class="absolute top-0 right-0 p-8 opacity-10">
            <Icon name="material-symbols:stadium" class="text-[120px]" />
          </div>
          <h2
            class="font-headline text-5xl font-black italic uppercase tracking-tighter mb-8 leading-none"
          >
            Home of <br /><span class="text-primary">The Octagon</span>
          </h2>
          <div class="space-y-6 max-w-md">
            <div>
              <p class="text-secondary uppercase text-xs tracking-widest mb-2">Official Venue</p>
              <h4 class="font-headline font-bold text-2xl uppercase">Tbilisi Sports Palace</h4>
              <p class="text-on-surface-variant font-body">
                2 Merab Kostava St, Tbilisi 0171, Georgia
              </p>
            </div>
            <div class="pt-8 border-t border-outline-variant">
              <div class="flex items-center gap-4 mb-4">
                <Icon name="material-symbols:directions-bus" class="text-primary" />
                <p class="text-sm">Metro Technical University Station (2 min walk)</p>
              </div>
              <div class="flex items-center gap-4">
                <Icon name="material-symbols:local-parking" class="text-primary" />
                <p class="text-sm">VIP and Underground Parking Available</p>
              </div>
            </div>
            <button
              class="mt-8 flex items-center gap-3 font-headline font-black italic uppercase tracking-widest hover:gap-6 transition-all"
            >
              GET DIRECTIONS <Icon name="material-symbols:arrow-forward" />
            </button>
          </div>
        </div>

        <div class="h-[500px] relative">
          <img
            alt="Map location of venue"
            loading="lazy"
            decoding="async"
            fetchpriority="low"
            class="w-full h-full object-cover grayscale brightness-50"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuBicXujtCvhoRs6l64Uxfn5mB2XaVoJ4MyICWPoAnq8_EUVJBDKkEBO5IdCs3TYsYkneYLZnoaDWVEQHlUk1r2ZnJ-yaBXNadi0GHZ-o-4pgmjNCfKmVyCCU8gBma22__KHBiRRlhD0WmxlyhO-TR9bYr1YPqenFaT9ZZbzYI4R2Rf2UWN0d8SOEqa1Jws46T2oUQMs1KVUH8Uw0A2zH1pGG-CC0PA1Q9EaN1z4wDTD3amOEHWfFvMHNPiWoVCof_W3x7ScTyJwpik"
          />
          <div
            class="absolute inset-0 border-[20px] border-surface-container-low pointer-events-none"
          />
          <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
            <div
              class="w-12 h-12 bg-primary-container animate-pulse flex items-center justify-center"
            >
              <Icon name="material-symbols:location-on" class="text-white" />
            </div>
          </div>
        </div>
      </div>
    </section>
  </main>
</template>

<style scoped>
.diagonal-line {
  width: 0.5rem;
  height: 3rem;
  transform: skewX(-15deg);
}
</style>
