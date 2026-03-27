<script setup lang="ts">
import { isFilled } from "@prismicio/client";
import type { Content } from "@prismicio/client";

defineProps(
  getSliceComponentProps<Content.SponsorLogosSlice>(["slice", "index", "slices", "context"]),
);
</script>

<template>
  <section
    class="py-12 border-t border-outline-variant/10"
    :data-slice-type="slice.slice_type"
    :data-slice-variation="slice.variation"
  >
    <div class="container mx-auto px-6 md:px-20">
      <p class="text-center text-[10px] font-bold uppercase tracking-[0.3em] text-on-surface-variant mb-12">
        {{ slice.primary.title }}
      </p>
      <div class="flex flex-wrap justify-center items-center gap-12 md:gap-24">
        <component
          v-for="(sponsor, index) in slice.primary.sponsors"
          :key="index"
          :is="isFilled.link(sponsor.link) ? 'a' : 'div'"
          v-bind="isFilled.link(sponsor.link) ? { href: sponsor.link.url, target: sponsor.link.target } : {}"
          class="opacity-30 grayscale hover:grayscale-0 hover:opacity-100 transition-all"
        >
          <img
            v-if="isFilled.image(sponsor.logo)"
            :alt="sponsor.logo.alt || 'Sponsor'"
            :src="sponsor.logo.url"
            class="h-12 w-auto object-contain"
          >
        </component>
      </div>
    </div>
  </section>
</template>