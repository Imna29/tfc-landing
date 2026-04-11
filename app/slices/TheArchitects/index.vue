<script setup lang="ts">
import { isFilled } from "@prismicio/client";
import type { Content } from "@prismicio/client";
import { computed } from "vue";

const props = defineProps(
  getSliceComponentProps<Content.TheArchitectsSlice>(["slice", "index", "slices", "context"]),
);

const leaders = computed(() => {
  const offsets = [0, 12, 24];
  return props.slice.primary.main.map((leader, index) => {
    const matchingExtra = props.slice.primary.more.find((item) => item.name === leader.name);
    const fallbackExtra = props.slice.primary.more[index];

    return {
      id: `${leader.name ?? "leader"}-${index}`,
      name: leader.name,
      role: leader.position,
      title: matchingExtra?.position || fallbackExtra?.position || "",
      image: leader.image,
      offset: offsets[index] ?? 0,
    };
  });
});
</script>

<template>
  <section
    class="py-32 px-8 bg-surface-container-low"
    :data-slice-type="slice.slice_type"
    :data-slice-variation="slice.variation"
  >
    <div class="max-w-7xl mx-auto">
      <h2
        class="font-headline text-5xl font-black italic uppercase tracking-tighter mb-20 text-center"
      >
        {{ slice.primary.title }}
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
            <img
              v-if="isFilled.image(leader.image)"
              :alt="leader.image.alt || leader.name || 'Leader'"
              class="w-full h-full object-cover"
              loading="lazy"
              decoding="async"
              fetchpriority="low"
              :src="leader.image.url"
            >
            <div class="absolute bottom-0 left-0 p-6 bg-gradient-to-t from-black to-transparent w-full">
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
</template>
