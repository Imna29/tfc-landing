<script setup lang="ts">
import { isFilled } from "@prismicio/client";
import type { Content } from "@prismicio/client";

type BadgeType = "champion" | "undefeated" | "contender";

interface FighterBadge {
  type: BadgeType;
  label: string;
}

interface FighterCard {
  id: string;
  name: string;
  nickname: string;
  record: string;
  division: string;
  image: string;
  badges: FighterBadge[];
}

const PLACEHOLDER_IMAGE = "/fighter-placeholder.svg";

const props = defineProps(
  getSliceComponentProps<Content.FightersSectionSlice>(["slice", "index", "slices", "context"]),
);

const getBadgeType = (label: string): BadgeType => {
  const normalizedLabel = label.toLowerCase();

  if (normalizedLabel.includes("champ")) {
    return "champion";
  }

  if (normalizedLabel.includes("undefeat")) {
    return "undefeated";
  }

  return "contender";
};

const fighters = computed<FighterCard[]>(() =>
  props.slice.primary.fighters
    .map((item) => {
      if (!isFilled.contentRelationship(item.fighter)) {
        return null;
      }

      const fighter = item.fighter;
      const fighterData = fighter.data;
      const divisionField = fighterData?.division;
      const imageField = fighterData?.image;

      const division =
        isFilled.contentRelationship(divisionField) && divisionField.data?.name
          ? divisionField.data.name
          : "Unknown Division";

      const badges = (fighterData?.badges ?? [])
        .map((badge) => {
          const label = badge.label?.trim();

          if (!label) {
            return null;
          }

          return {
            type: getBadgeType(label),
            label,
          };
        })
        .filter((badge): badge is FighterBadge => badge !== null);

      const image =
        isFilled.image(imageField) && imageField.url ? imageField.url : PLACEHOLDER_IMAGE;

      return {
        id: fighter.uid || fighter.id,
        name: fighterData?.name || "Unknown Fighter",
        nickname: fighterData?.nickname || "",
        record: fighterData?.record || "—",
        division,
        image,
        badges,
      };
    })
    .filter((fighter): fighter is FighterCard => fighter !== null),
);

const title = computed(() => props.slice.primary.title || "Elite");
const titleHighlight = computed(() => props.slice.primary.title_highlight || "Warriors");
const subtitle = computed(
  () =>
    props.slice.primary.subtitle ||
    "The roster of Tbilisi Fighting Championship. Athletes forged in iron, competing for the crown of the Caucasus.",
);
const searchPlaceholder = computed(() => props.slice.primary.search_placeholder || "FIND A FIGHTER...");
const loadMoreLabel = computed(() => props.slice.primary.load_more_label || "Load More Fighters");

const divisions = computed(() => {
  const uniqueDivisions = Array.from(new Set(fighters.value.map((fighter) => fighter.division)));

  return ["All Divisions", ...uniqueDivisions];
});

const selectedDivision = ref("All Divisions");
const searchQuery = ref("");

watch(divisions, (nextDivisions) => {
  if (!nextDivisions.includes(selectedDivision.value)) {
    selectedDivision.value = "All Divisions";
  }
});

const filteredFighters = computed(() => {
  let result = fighters.value;

  if (selectedDivision.value !== "All Divisions") {
    result = result.filter((fighter) => fighter.division === selectedDivision.value);
  }

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();

    result = result.filter(
      (fighter) =>
        fighter.name.toLowerCase().includes(query) || fighter.nickname.toLowerCase().includes(query),
    );
  }

  return result;
});
</script>

<template>
  <section
    class="pt-32 pb-20"
    :data-slice-type="slice.slice_type"
    :data-slice-variation="slice.variation"
  >
    <section class="px-8 mb-16 max-w-7xl mx-auto">
      <div class="flex flex-col md:flex-row md:items-end justify-between gap-8 border-b border-outline-variant pb-12">
        <div>
          <h1 class="text-6xl md:text-8xl font-headline font-black italic tracking-tighter uppercase leading-none mb-4">
            {{ title }} <span class="text-primary-container">{{ titleHighlight }}</span>
          </h1>
          <p class="text-secondary font-body max-w-md uppercase tracking-widest text-sm font-light">
            {{ subtitle }}
          </p>
        </div>
        <div class="relative w-full md:w-96">
          <Icon name="material-symbols:search" class="absolute left-4 top-1/2 -translate-y-1/2 text-outline" />
          <input
            v-model="searchQuery"
            type="text"
            :placeholder="searchPlaceholder"
            class="w-full bg-surface-container-lowest border-b-2 border-outline-variant focus:border-primary px-12 py-4 font-headline italic font-bold tracking-tight outline-none placeholder:text-outline-variant uppercase"
          >
        </div>
      </div>
    </section>

    <section class="px-8 mb-12 max-w-7xl mx-auto overflow-x-auto">
      <div class="flex space-x-4 pb-4">
        <button
          v-for="division in divisions"
          :key="division"
          class="px-8 py-3 font-headline font-black italic tracking-tighter uppercase whitespace-nowrap transition-colors"
          :class="selectedDivision === division
            ? 'bg-primary-container text-white'
            : 'bg-surface-container-low text-on-surface hover:bg-surface-container-high'"
          @click="selectedDivision = division"
        >
          {{ division }}
        </button>
      </div>
    </section>

    <section class="px-8 max-w-7xl mx-auto">
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-12">
        <NuxtLink
          v-for="fighter in filteredFighters"
          :key="fighter.id"
          :to="`/fighters/${fighter.id}`"
          class="group relative fighter-card-skew bg-surface-container-low overflow-hidden hover:scale-[1.02] transition-transform duration-500"
        >
          <div class="h-[500px] relative">
            <img
              :alt="fighter.name"
              class="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700"
              :src="fighter.image"
            >
            <div class="absolute inset-0 bg-gradient-to-t from-surface-container-lowest via-transparent to-transparent opacity-90" />
            <div v-if="fighter.badges.length > 0" class="absolute top-6 left-6 flex flex-col items-start gap-2">
              <template v-for="badge in fighter.badges" :key="badge.label">
                <span
                  v-if="badge.type === 'champion'"
                  class="bg-primary-container text-white text-[10px] font-black italic tracking-tighter px-3 py-1 uppercase"
                >
                  {{ badge.label }}
                </span>
                <span
                  v-else
                  class="bg-white/10 backdrop-blur-md text-white text-[10px] font-bold tracking-widest px-3 py-1 uppercase"
                >
                  {{ badge.label }}
                </span>
              </template>
            </div>
            <div class="absolute bottom-6 left-6 right-6">
              <p v-if="fighter.nickname" class="text-primary font-headline italic font-black text-xl mb-1 uppercase tracking-tight">
                "{{ fighter.nickname.toUpperCase() }}"
              </p>
              <h3 class="text-4xl font-headline font-black italic uppercase leading-none tracking-tighter mb-4">
                {{ fighter.name }}
              </h3>
              <div class="flex justify-between items-center border-t border-white/10 pt-4">
                <div>
                  <p class="text-[10px] text-outline uppercase tracking-widest font-bold">RECORD</p>
                  <p class="text-2xl font-headline font-black italic text-on-surface tracking-tighter">{{ fighter.record }}</p>
                </div>
                <div class="text-right">
                  <p class="text-[10px] text-outline uppercase tracking-widest font-bold">DIVISION</p>
                  <p class="text-lg font-headline font-black italic text-secondary tracking-tighter uppercase">{{ fighter.division }}</p>
                </div>
              </div>
            </div>
          </div>
        </NuxtLink>
      </div>

      <div class="mt-20 flex justify-center">
        <button class="group flex items-center gap-4 bg-surface-container-high border border-outline-variant px-12 py-6 font-headline font-black italic tracking-tighter uppercase hover:bg-primary-container hover:text-white transition-all duration-300">
          {{ loadMoreLabel }}
          <Icon name="material-symbols:keyboard-double-arrow-right" class="group-hover:translate-x-2 transition-transform" />
        </button>
      </div>
    </section>
  </section>
</template>

<style scoped>
.fighter-card-skew {
  clip-path: polygon(0 0, 100% 0, 100% 90%, 90% 100%, 0 100%);
}
</style>
