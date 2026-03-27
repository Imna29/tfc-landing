<script setup lang="ts">
import { asText } from "@prismicio/client/richtext";
import { asDate } from "@prismicio/client";
import { isFilled } from "@prismicio/client";
import type { Content } from "@prismicio/client";

defineProps(
  getSliceComponentProps<Content.HeroSectionSlice>(["slice", "index", "slices", "context"]),
);
</script>

<template>
  <section
    class="relative min-h-[921px] flex items-center overflow-hidden"
    :data-slice-type="slice.slice_type"
    :data-slice-variation="slice.variation"
  >
    <div class="absolute inset-0 z-0">
      <div
        class="absolute inset-0 bg-gradient-to-r from-background via-background/60 to-transparent z-10"
      />
      <img
        v-if="isFilled.image(slice.primary.background_image)"
        alt="Hero Background"
        class="w-full h-full object-cover grayscale opacity-60"
        :src="slice.primary.background_image.url"
      />
    </div>

    <div class="container mx-auto px-6 md:px-20 relative z-20">
      <div class="max-w-4xl">
        <div
          class="inline-block bg-primary-container text-white px-4 py-1 mb-6 font-bold uppercase tracking-tighter skew-x-[-12deg]"
        >
          <span class="block skew-x-[12deg]">{{ slice.primary.badge_text }}</span>
        </div>
        <h1
          class="font-headline text-6xl md:text-9xl font-black italic uppercase leading-[0.9] tracking-tighter mb-8 text-white"
        >
          {{ slice.primary.headline_1 }}<br />{{ slice.primary.headline_2 }}<br /><span
            class="text-primary-container"
            >{{ slice.primary.headline_3 }}</span
          >
        </h1>
        <p
          class="text-xl md:text-2xl font-light text-on-surface-variant max-w-2xl mb-12 border-l-4 border-primary-container pl-6"
        >
          {{ asText(slice.primary.description) }}
        </p>
        <div v-if="isFilled.repeatable(slice.primary.cta)" class="flex flex-col sm:flex-row gap-4">
          <PrismicLink
            v-for="(button, index) in slice.primary.cta"
            :key="index"
            :field="button.link"
            :class="[
              'px-10 py-5 font-black uppercase text-lg flex items-center justify-center gap-3 group',
              button.link.variant === 'Primary'
                ? 'bg-primary-container text-white'
                : 'border-2 border-outline-variant/30 text-white backdrop-blur-sm hover:bg-white/5 transition-colors'
            ]"
          >
            {{ button.label }}
            <Icon
              :name="button.icon"
              :class="button.link.variant === 'Primary' ? 'group-hover:translate-x-1 transition-transform' : ''"
            />
          </PrismicLink>
        </div>
      </div>
    </div>

    <div class="absolute bottom-10 right-20 hidden lg:block">
      <div class="flex flex-col items-end gap-2 text-primary font-headline italic font-bold">
        <span class="text-6xl">{{ asDate(slice.primary.event_time)?.toLocaleDateString() }}</span>
        <span class="text-xl tracking-widest">{{ slice.primary.event_location }}</span>
      </div>
    </div>
  </section>
</template>
