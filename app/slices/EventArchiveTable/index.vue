<script setup lang="ts">
import { isFilled } from "@prismicio/client";
import { asDate } from "@prismicio/client";
import { PrismicLink } from "@prismicio/vue";
import type { Content } from "@prismicio/client";
import { ref, onMounted, onUnmounted, nextTick } from "vue";

const props = defineProps(
  getSliceComponentProps<Content.EventArchiveTableSlice>(["slice", "index", "slices", "context"]),
);

const sectionRef = ref<HTMLElement | null>(null);
const isHeaderInView = ref(false);
const rowStates = ref<Record<number, boolean>>({});
let headerObserver: IntersectionObserver | null = null;
let rowObserver: IntersectionObserver | null = null;

onMounted(async () => {
  await nextTick();
  if (!sectionRef.value) return;

  headerObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          isHeaderInView.value = true;
          headerObserver?.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.1 }
  );
  const header = sectionRef.value.querySelector("[data-section-header]");
  if (header) headerObserver.observe(header);

  const rows = sectionRef.value.querySelectorAll<HTMLElement>("[data-event-row]");
  rows.forEach((row, index) => {
    const rect = row.getBoundingClientRect();
    const isAboveFold = rect.top < window.innerHeight && rect.bottom > 0;
    if (isAboveFold) {
      setTimeout(() => {
        rowStates.value[index] = true;
      }, index * 60);
    }
  });

  rowObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const el = entry.target as HTMLElement;
          const idx = Number(el.dataset.eventRow);
          const index = Array.from(rows).indexOf(el);
          if (!Number.isNaN(idx)) {
            setTimeout(() => {
              rowStates.value[idx] = true;
            }, index * 60);
          }
          rowObserver?.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.1, rootMargin: "0px 0px -30px 0px" }
  );

  rows.forEach((row) => {
    const idx = Number(row.dataset.eventRow);
    if (Number.isNaN(idx) || !rowStates.value[idx]) {
      rowObserver?.observe(row);
    }
  });
});

onUnmounted(() => {
  headerObserver?.disconnect();
  rowObserver?.disconnect();
});
</script>

<template>
  <section
    ref="sectionRef"
    class="py-24 bg-surface-container-lowest"
    :data-slice-type="slice.slice_type"
    :data-slice-variation="slice.variation"
  >
    <div class="max-w-7xl mx-auto px-8">
      <div
        data-section-header
        class="flex items-center gap-4 mb-12 mma-fade-left"
        :class="{ 'mma-active': isHeaderInView }"
      >
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
              :data-event-row="index"
              class="border-b border-outline-variant/30 hover:bg-surface-container-low transition-colors group mma-fade-up"
              :class="{ 'mma-active': rowStates[index] }"
              :style="{ transitionDelay: `${index * 60}ms` }"
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

      <div
        v-if="slice.primary.load_more_button_label"
        class="mt-12 text-center mma-fade-up"
        :class="{ 'mma-active': isHeaderInView }"
        :style="{ transitionDelay: '0.3s' }"
      >
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
