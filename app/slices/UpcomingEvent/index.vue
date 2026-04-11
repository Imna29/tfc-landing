<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { asDate } from "@prismicio/client";
import { isFilled } from "@prismicio/client";
import type { Content } from "@prismicio/client";

const props = defineProps(
  getSliceComponentProps<Content.UpcomingEventSlice>(["slice", "index", "slices", "context"]),
);

const days = ref(0)
const hours = ref(0)
const minutes = ref(0)
const seconds = ref(0)

let interval: ReturnType<typeof setInterval> | null = null

const updateCountdown = (targetDate: Date) => {
  const now = new Date()
  const diff = targetDate.getTime() - now.getTime()

  if (diff <= 0) {
    days.value = 0
    hours.value = 0
    minutes.value = 0
    seconds.value = 0
    return
  }

  days.value = Math.floor(diff / (1000 * 60 * 60 * 24))
  hours.value = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  minutes.value = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  seconds.value = Math.floor((diff % (1000 * 60)) / 1000)
}

onMounted(() => {
  const targetDate = asDate(props.slice.primary.event_date)
  if (targetDate) {
    updateCountdown(targetDate)
    interval = setInterval(() => updateCountdown(targetDate), 1000)
  }
})

onUnmounted(() => {
  if (interval) {
    clearInterval(interval)
  }
})
</script>

<template>
  <section
    class="bg-surface-container-low py-24 relative overflow-hidden"
    :data-slice-type="slice.slice_type"
    :data-slice-variation="slice.variation"
  >
    <div class="absolute top-0 right-0 w-1/3 h-full opacity-5 pointer-events-none">
      <p class="text-[20rem] font-black italic whitespace-nowrap leading-none">{{ slice.primary.background_watermark }}</p>
    </div>

    <div class="container mx-auto px-6 md:px-20 relative z-10">
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        <div class="lg:col-span-4">
          <h2 class="font-headline text-5xl font-black italic uppercase tracking-tighter mb-6">{{ slice.primary.title }}</h2>
          <div class="space-y-4">
            <div class="flex items-center gap-4 border-b border-outline-variant/15 pb-4">
              <Icon name="material-symbols:calendar-today" class="text-primary text-xl" />
              <p class="text-lg font-bold uppercase">{{ asDate(slice.primary.event_date)?.toLocaleDateString() }}</p>
            </div>
            <div class="flex items-center gap-4 border-b border-outline-variant/15 pb-4">
              <Icon name="material-symbols:location-on" class="text-primary text-xl" />
              <p class="text-lg font-bold uppercase">{{ slice.primary.event_venue }}</p>
            </div>
          </div>

          <div class="flex gap-4 mt-12">
            <div class="flex-1 bg-surface-container-highest p-4 text-center">
              <p class="text-4xl font-black font-headline text-white">{{ days.toString().padStart(2, '0') }}</p>
              <p class="text-xs uppercase text-primary font-bold">Days</p>
            </div>
            <div class="flex-1 bg-surface-container-highest p-4 text-center">
              <p class="text-4xl font-black font-headline text-white">{{ hours.toString().padStart(2, '0') }}</p>
              <p class="text-xs uppercase text-primary font-bold">Hrs</p>
            </div>
            <div class="flex-1 bg-surface-container-highest p-4 text-center">
              <p class="text-4xl font-black font-headline text-white">{{ minutes.toString().padStart(2, '0') }}</p>
              <p class="text-xs uppercase text-primary font-bold">Mins</p>
            </div>
          </div>
        </div>

        <div class="lg:col-span-8">
          <div class="bg-surface-container-highest p-1 border-2 border-primary-container/20">
            <div class="relative aspect-video flex items-center justify-center group cursor-pointer overflow-hidden">
              <img
                v-if="isFilled.image(slice.primary.event_poster)"
                :alt="slice.primary.main_headline || 'Event Poster'"
                loading="lazy"
                decoding="async"
                fetchpriority="low"
                class="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                :src="slice.primary.event_poster.url"
              >
              <div class="absolute inset-0 bg-background/40 group-hover:bg-background/20 transition-colors" />
              <div class="relative z-10 text-center px-4">
                <h3 class="font-headline text-4xl md:text-6xl font-black italic uppercase text-white drop-shadow-2xl">
                  {{ slice.primary.main_headline }}
                </h3>
                <p class="text-primary font-black uppercase tracking-widest text-xl mt-2">{{ slice.primary.subtitle }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
