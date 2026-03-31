<script setup lang="ts">
import { isFilled } from "@prismicio/client";
import { asDate } from "@prismicio/client";
import { PrismicLink } from "@prismicio/vue";
import type { Content } from "@prismicio/client";

defineProps(
  getSliceComponentProps<Content.EventArchiveTableSlice>(["slice", "index", "slices", "context"]),
);
</script>

<template>
  <section
    class="py-24 bg-surface-container-lowest"
    :data-slice-type="slice.slice_type"
    :data-slice-variation="slice.variation"
  >
    <div class="max-w-7xl mx-auto px-8">
      <div class="flex items-center gap-4 mb-12">
        <div class="bg-secondary-fixed diagonal-line" />
        <h2 class="font-headline text-4xl font-black italic uppercase tracking-tighter">
          {{ slice.primary.title }}
        </h2>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="border-b border-outline-variant text-secondary uppercase text-[10px] tracking-[0.3em]">
              <th
                v-for="(header, index) in slice.primary.table_headers"
                :key="index"
                :class="[
                  'py-6 px-4',
                  index === slice.primary.table_headers.length - 1 ? 'text-right' : ''
                ]"
              >
                {{ header.text }}
              </th>
            </tr>
          </thead>
          <tbody class="font-headline font-bold text-lg uppercase italic">
            <tr
              v-for="(event, index) in slice.primary.events"
              :key="index"
              class="border-b border-outline-variant/30 hover:bg-surface-container-low transition-colors group"
            >
              <td class="py-8 px-4">{{ event.name }}</td>
              <td class="py-8 px-4 text-secondary text-sm font-body not-italic">
                {{ asDate(event.date)?.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) }}
              </td>
              <td class="py-8 px-4 text-primary">{{ event.result }}</td>
              <td class="py-8 px-4 text-right">
                <a
                  v-if="event.replay_youtube_link?.embed_url"
                  :href="event.replay_youtube_link.embed_url"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="inline-flex items-center gap-2 group-hover:text-primary transition-colors"
                >
                  REPLAY <Icon name="material-symbols:play-circle" class="text-sm" />
                </a>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="slice.primary.load_more_button_label" class="mt-12 text-center">
        <PrismicLink
          v-if="isFilled.link(slice.primary.load_more_button_link)"
          :field="slice.primary.load_more_button_link"
          class="text-secondary font-headline font-bold italic uppercase tracking-widest hover:text-white transition-colors underline underline-offset-8"
        >
          {{ slice.primary.load_more_button_label }}
        </PrismicLink>
      </div>
    </div>
  </section>
</template>

<style scoped>
.diagonal-line {
  width: 0.5rem;
  height: 3rem;
  transform: skewX(-15deg);
}
</style>