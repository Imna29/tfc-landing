<script setup lang="ts">
import type { Content } from "@prismicio/client";

defineProps(
  getSliceComponentProps<Content.MissionValuesGridSlice>(["slice", "index", "slices", "context"]),
);
</script>

<template>
  <section
    class="py-24 px-8 bg-surface-container-lowest"
    :data-slice-type="slice.slice_type"
    :data-slice-variation="slice.variation"
  >
    <div class="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
      <div
        v-if="slice.primary.items[0]"
        class="md:col-span-2 bg-surface-container-low p-12 relative overflow-hidden group"
      >
        <div
          class="absolute top-0 right-0 w-32 h-32 bg-primary-container/10 skew-box translate-x-10 -translate-y-10"
        />
        <h3 class="font-headline text-4xl font-black italic uppercase mb-6">
          {{ slice.primary.items[0].title }}
        </h3>
        <p class="text-xl leading-relaxed text-on-surface/90">
          {{ slice.primary.items[0].text }}
        </p>
      </div>

      <div
        v-if="slice.primary.items[1]"
        class="bg-primary-container p-12 flex flex-col justify-end"
      >
        <Icon :name="slice.primary.items[1].icon || 'material-symbols:bolt'" class="text-6xl mb-6" />
        <h3 class="font-headline text-3xl font-black italic uppercase">
          {{ slice.primary.items[1].title }}
        </h3>
        <p class="text-white/80">
          {{ slice.primary.items[1].text }}
        </p>
      </div>

      <div v-if="slice.primary.items[2]" class="bg-surface-container-highest p-12">
        <h3 class="font-headline text-3xl font-black italic uppercase mb-4">
          {{ slice.primary.items[2].title }}
        </h3>
        <p class="text-on-surface/80">
          {{ slice.primary.items[2].text }}
        </p>
      </div>

      <div
        v-if="slice.primary.items[3]"
        class="md:col-span-2 bg-surface-container-low p-12 relative overflow-hidden"
      >
        <div class="flex items-center gap-8">
          <div class="flex-1">
            <h3 class="font-headline text-4xl font-black italic uppercase mb-4">
              {{ slice.primary.items[3].title }}
            </h3>
            <p class="text-on-surface/80">
              {{ slice.primary.items[3].text }}
            </p>
          </div>
          <Icon
            :name="slice.primary.items[3].icon || 'material-symbols:shield'"
            class="text-8xl text-outline-variant opacity-30"
          />
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.skew-box {
  clip-path: polygon(10% 0, 100% 0, 90% 100%, 0 100%);
}
</style>
