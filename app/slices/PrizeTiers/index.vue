<script setup lang="ts">
import { isFilled } from "@prismicio/client";
import type { Content } from "@prismicio/client";

defineProps(
  getSliceComponentProps<Content.PrizeTiersSlice>(["slice", "index", "slices", "context"]),
);
</script>

<template>
  <section
    class="py-24 px-6 md:px-20 bg-surface-container-lowest"
    :data-slice-type="slice.slice_type"
    :data-slice-variation="slice.variation"
  >
    <div class="max-w-[1440px] mx-auto">
      <h2
        v-if="slice.primary.heading"
        class="font-headline text-4xl md:text-6xl font-black italic uppercase tracking-tighter border-l-4 border-primary-container pl-6 mb-8"
      >
        {{ slice.primary.heading }}
      </h2>

      <div
        v-if="isFilled.richText(slice.primary.intro)"
        class="max-w-3xl text-lg text-on-surface/80 leading-relaxed mb-16"
      >
        <PrismicRichText :field="slice.primary.intro" />
      </div>

      <ol
        v-if="slice.primary.tiers.length > 0"
        class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
      >
        <li
          v-for="(tier, index) in slice.primary.tiers"
          :key="index"
          class="flex flex-col p-10"
          :class="index === 0 ? 'bg-primary-container text-white' : 'bg-surface-container-low'"
        >
          <img
            v-if="isFilled.image(tier.image)"
            :src="tier.image.url"
            :alt="tier.image.alt || ''"
            :width="tier.image.dimensions.width"
            :height="tier.image.dimensions.height"
            loading="lazy"
            decoding="async"
            class="w-full h-48 object-cover mb-8"
          />
          <p
            v-if="tier.place"
            class="text-xs font-bold uppercase tracking-widest mb-4"
            :class="index === 0 ? 'text-white/70' : 'text-primary'"
          >
            {{ tier.place }}
          </p>
          <h3 v-if="tier.prize" class="font-headline text-3xl font-black italic uppercase mb-4">
            {{ tier.prize }}
          </h3>
          <p
            v-if="tier.detail"
            class="leading-relaxed"
            :class="index === 0 ? 'text-white/80' : 'text-on-surface/80'"
          >
            {{ tier.detail }}
          </p>
        </li>
      </ol>
    </div>
  </section>
</template>
