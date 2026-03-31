<script setup lang="ts">
import { isFilled } from "@prismicio/client";
import { PrismicLink } from "@prismicio/vue";
import type { Content } from "@prismicio/client";

defineProps(
  getSliceComponentProps<Content.VenueInformationSlice>(["slice", "index", "slices", "context"]),
);
</script>

<template>
  <section
    class="py-24 bg-surface-dim overflow-hidden"
    :data-slice-type="slice.slice_type"
    :data-slice-variation="slice.variation"
  >
    <div class="max-w-7xl mx-auto px-8 grid grid-cols-1 lg:grid-cols-2 gap-0">
      <div class="bg-surface-container-low p-12 flex flex-col justify-center relative">
        <div class="absolute top-0 right-0 p-8 opacity-10">
          <Icon name="material-symbols:stadium" class="text-[120px]" />
        </div>
        <h2
          class="font-headline text-5xl font-black italic uppercase tracking-tighter mb-8 leading-none"
        >
          {{ slice.primary.title_line_1 }} <br /><span class="text-primary">{{
            slice.primary.title_line_2
          }}</span>
        </h2>
        <div class="space-y-6 max-w-md">
          <div>
            <p class="text-secondary uppercase text-xs tracking-widest mb-2">
              {{ slice.primary.venue_label }}
            </p>
            <h4 class="font-headline font-bold text-2xl uppercase">
              {{ slice.primary.venue_name }}
            </h4>
            <p v-if="slice.primary.address" class="text-on-surface-variant font-body">
              {{ slice.primary.address }}
            </p>
          </div>
          <div class="pt-8 border-t border-outline-variant">
            <div
              v-for="(info, index) in slice.primary.transport_info"
              :key="index"
              class="flex items-center gap-4 mb-4"
            >
              <Icon :name="info.icon || 'material-symbols:directions-bus'" class="text-primary" />
              <p class="text-sm">{{ info.text }}</p>
            </div>
          </div>
          <PrismicLink
            v-if="isFilled.link(slice.primary.directions_buttons_link)"
            :field="slice.primary.directions_buttons_link"
            class="mt-8 inline-flex items-center gap-3 font-headline font-black italic uppercase tracking-widest hover:gap-6 transition-all"
          >
            {{ slice.primary.directions_button_label }}
            <Icon name="material-symbols:arrow-forward" />
          </PrismicLink>
        </div>
      </div>

      <div class="h-[500px] relative bg-surface-container-lowest">
        <div v-if="slice.primary.google_maps_embed" class="w-full h-full p-4">
          <iframe
            :src="slice.primary.google_maps_embed"
            width="100%"
            height="100%"
            style="border: 0"
            allowfullscreen=""
            loading="lazy"
            referrerpolicy="no-referrer-when-downgrade"
          />
        </div>
        <div
          class="absolute inset-0 border-[20px] border-surface-container-low pointer-events-none"
        />
      </div>
    </div>
  </section>
</template>
