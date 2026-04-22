<script setup lang="ts">
import * as prismic from "@prismicio/client";
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
  disciplines: string[];
  image: string;
  imageWidth: number;
  imageHeight: number;
  nicknameDisplay: string;
  searchText: string;
  badges: FighterBadge[];
}

const PLACEHOLDER_IMAGE = "/fighter-placeholder.svg";
const ALL_DIVISIONS_LABEL = "All Divisions";
const ALL_DISCIPLINES_LABEL = "All Disciplines";
const FIGHTERS_BATCH_SIZE = 9;

const fighterCardsSectionRef = ref<HTMLElement | null>(null);
const inViewMap = ref<Record<string, boolean>>({});
const animatedMap = ref<Record<string, boolean>>({});
const isMobileViewport = ref(false);
const isMounted = ref(false);

let mobileViewportQuery: MediaQueryList | null = null;
let observer: IntersectionObserver | null = null;
let animationObserver: IntersectionObserver | null = null;

const props = defineProps(
  getSliceComponentProps<Content.FightersSectionSlice>(["slice", "index", "slices", "context"]),
);

const { client } = usePrismic();
const { locale } = useI18n();

const initializeMobileObserver = () => {
  const shouldObserve = mobileViewportQuery?.matches ?? false;
  isMobileViewport.value = shouldObserve;

  observer?.disconnect();
  observer = null;
  inViewMap.value = {};

  if (!shouldObserve) {
    return;
  }

  const fighterCards = fighterCardsSectionRef.value?.querySelectorAll<HTMLElement>("[data-fighter-id]");
  if (!fighterCards?.length) {
    return;
  }

  observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const fighterId = (entry.target as HTMLElement).dataset.fighterId;
        if (!fighterId) {
          return;
        }

        inViewMap.value[fighterId] = entry.isIntersecting;
      });
    },
    {
      threshold: 0.45,
    },
  );

  fighterCards.forEach((card) => observer?.observe(card));
};

const handleViewportChange = () => {
  initializeMobileObserver();
};

const initializeAnimationObserver = () => {
  animationObserver?.disconnect();
  animationObserver = null;

  const fighterCards = fighterCardsSectionRef.value?.querySelectorAll<HTMLElement>("[data-fighter-id]");
  if (!fighterCards?.length) {
    return;
  }

  fighterCards.forEach((card) => {
    const rect = card.getBoundingClientRect();
    const isInViewport = rect.top < window.innerHeight && rect.bottom > 0;
    const fighterId = card.dataset.fighterId;
    if (isInViewport && fighterId) {
      animatedMap.value[fighterId] = true;
    }
  });

  animationObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const fighterId = (entry.target as HTMLElement).dataset.fighterId;
          if (fighterId) {
            animatedMap.value[fighterId] = true;
          }
          animationObserver?.unobserve(entry.target);
        }
      });
    },
    {
      threshold: 0,
      rootMargin: "0px 0px -60px 0px",
    },
  );

  fighterCards.forEach((card) => {
    const fighterId = card.dataset.fighterId;
    if (fighterId && !animatedMap.value[fighterId]) {
      animationObserver?.observe(card);
    }
  });
};

const referencedFighterDocumentIds = computed(() =>
  Array.from(
    new Set(
      props.slice.primary.fighters.flatMap((item) =>
        isFilled.contentRelationship(item.fighter) ? [item.fighter.id] : [],
      ),
    ),
  ),
);

const { data: fighterDocuments } = await useAsyncData(
  () =>
    `fighters-section-fighters-${props.index}-${locale.value}-${referencedFighterDocumentIds.value.join(",") || "none"}`,
  () => {
    if (referencedFighterDocumentIds.value.length === 0) {
      return Promise.resolve([] as Content.FighterDocument[]);
    }

    return client.getAllByType("fighter", {
      lang: locale.value,
      filters: [prismic.filter.any("document.id", referencedFighterDocumentIds.value)],
    });
  },
  {
    watch: [locale, referencedFighterDocumentIds],
  },
);

const fighterDocumentsById = computed(
  () =>
    new Map(
      (fighterDocuments.value ?? []).map((fighterDocument) => [fighterDocument.id, fighterDocument]),
    ),
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

      const fighterDocument = fighterDocumentsById.value.get(item.fighter.id);

      if (!fighterDocument) {
        return null;
      }

      const fighterData = fighterDocument.data;
      const divisionField = fighterData?.division;
      const imageField = fighterData?.image;

      const division =
        isFilled.contentRelationship(divisionField) && divisionField.data?.name
          ? divisionField.data.name
          : "Unknown Division";
      const disciplines = (fighterData?.disciplines ?? [])
        .map((disciplineItem) => {
          const disciplineField = disciplineItem.discipline;

          if (isFilled.contentRelationship(disciplineField) && disciplineField.data?.name) {
            return disciplineField.data.name;
          }

          return null;
        })
        .filter((discipline): discipline is string => discipline !== null);

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
      const imageWidth =
        isFilled.image(imageField) && imageField.dimensions?.width
          ? imageField.dimensions.width
          : 800;
      const imageHeight =
        isFilled.image(imageField) && imageField.dimensions?.height
          ? imageField.dimensions.height
          : 1000;
      const name = fighterData?.name || "Unknown Fighter";
      const nickname = fighterData?.nickname || "";

      return {
        id: fighterDocument.uid || fighterDocument.id,
        name,
        nickname,
        record: fighterData?.record || "—",
        division,
        disciplines: Array.from(new Set(disciplines)),
        image,
        imageWidth,
        imageHeight,
        nicknameDisplay: nickname.toUpperCase(),
        searchText: `${name} ${nickname}`.toLowerCase(),
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
const searchPlaceholder = computed(
  () => props.slice.primary.search_placeholder || "FIND A FIGHTER...",
);
const loadMoreLabel = computed(() => props.slice.primary.load_more_label || "Load More Fighters");

const divisionOrder = ["BANTAMWEIGHT", "FEATHERWEIGHT", "LIGHTWEIGHT", "WELTERWEIGHT", "HEAVYWEIGHT"];

const divisions = computed(() => {
  const uniqueDivisions = Array.from(new Set(fighters.value.map((fighter) => fighter.division)));

  const sortedDivisions = uniqueDivisions.sort((a, b) => {
    const indexA = divisionOrder.findIndex((d) => d.toLowerCase() === a.toLowerCase());
    const indexB = divisionOrder.findIndex((d) => d.toLowerCase() === b.toLowerCase());

    if (indexA !== -1 && indexB !== -1) return indexA - indexB;
    if (indexA !== -1) return -1;
    if (indexB !== -1) return 1;
    return a.localeCompare(b);
  });

  return [ALL_DIVISIONS_LABEL, ...sortedDivisions];
});

const disciplineTypes = computed(() => {
  const uniqueDisciplines = Array.from(
    new Set(fighters.value.flatMap((fighter) => fighter.disciplines)),
  );

  return [ALL_DISCIPLINES_LABEL, ...uniqueDisciplines];
});

const selectedDivision = shallowRef(ALL_DIVISIONS_LABEL);
const selectedDiscipline = shallowRef(ALL_DISCIPLINES_LABEL);
const searchQuery = shallowRef("");
const visibleCount = shallowRef(FIGHTERS_BATCH_SIZE);

const normalizedSearchQuery = computed(() => searchQuery.value.trim().toLowerCase());

watch(divisions, (nextDivisions) => {
  if (!nextDivisions.includes(selectedDivision.value)) {
    selectedDivision.value = ALL_DIVISIONS_LABEL;
  }
});

watch(disciplineTypes, (nextDisciplineTypes) => {
  if (!nextDisciplineTypes.includes(selectedDiscipline.value)) {
    selectedDiscipline.value = ALL_DISCIPLINES_LABEL;
  }
});

watch([selectedDivision, selectedDiscipline, normalizedSearchQuery], () => {
  visibleCount.value = FIGHTERS_BATCH_SIZE;
  animatedMap.value = {};
});

const filteredFighters = computed(() => {
  let result = fighters.value;

  if (selectedDivision.value !== ALL_DIVISIONS_LABEL) {
    result = result.filter((fighter) => fighter.division === selectedDivision.value);
  }

  if (selectedDiscipline.value !== ALL_DISCIPLINES_LABEL) {
    result = result.filter((fighter) => fighter.disciplines.includes(selectedDiscipline.value));
  }

  if (normalizedSearchQuery.value) {
    result = result.filter((fighter) => fighter.searchText.includes(normalizedSearchQuery.value));
  }

  return result;
});

const visibleFighters = computed(() => filteredFighters.value.slice(0, visibleCount.value));
const hasMoreFighters = computed(() => visibleCount.value < filteredFighters.value.length);
const showLoadMore = computed(() => filteredFighters.value.length > 0 && hasMoreFighters.value);

watch(
  () => visibleFighters.value.map((fighter) => fighter.id).join(","),
  async () => {
    await nextTick();
    initializeAnimationObserver();

    if (!isMobileViewport.value) {
      return;
    }

    initializeMobileObserver();
  },
);

onMounted(async () => {
  mobileViewportQuery = window.matchMedia("(max-width: 767px)");
  mobileViewportQuery.addEventListener("change", handleViewportChange);

  await nextTick();
  initializeMobileObserver();
  initializeAnimationObserver();
  isMounted.value = true;
});

onUnmounted(() => {
  mobileViewportQuery?.removeEventListener("change", handleViewportChange);
  observer?.disconnect();
  animationObserver?.disconnect();
});

const loadMore = () => {
  visibleCount.value = Math.min(
    visibleCount.value + FIGHTERS_BATCH_SIZE,
    filteredFighters.value.length,
  );
};
</script>

<template>
  <section
    class="pt-32 pb-20"
    :data-slice-type="slice.slice_type"
    :data-slice-variation="slice.variation"
  >
    <section class="px-8 mb-16 max-w-7xl mx-auto">
      <div
        class="flex flex-col md:flex-row md:items-end justify-between gap-8 border-b border-outline-variant pb-12"
      >
        <div>
          <h1
            class="text-6xl md:text-8xl font-headline font-black italic tracking-tighter uppercase leading-none mb-4"
          >
            {{ title }} <span class="text-primary-container">{{ titleHighlight }}</span>
          </h1>
          <p class="text-secondary font-body max-w-md uppercase tracking-widest text-sm font-light">
            {{ subtitle }}
          </p>
        </div>
        <div class="relative w-full md:w-96">
          <Icon
            name="material-symbols:search"
            class="absolute left-4 top-1/2 -translate-y-1/2 text-outline"
          />
          <input
            v-model="searchQuery"
            type="text"
            :placeholder="searchPlaceholder"
            class="w-full bg-surface-container-lowest border-b-2 border-outline-variant focus:border-primary px-12 py-4 font-headline italic font-bold tracking-tight outline-none placeholder:text-outline-variant uppercase"
          />
        </div>
      </div>
    </section>

    <section class="px-8 mb-12 max-w-7xl mx-auto overflow-x-auto">
      <div class="flex flex-col gap-4 pb-4">
        <div class="flex w-max space-x-4">
          <button
            v-for="division in divisions"
            :key="division"
            type="button"
            class="px-8 py-3 font-headline font-black italic tracking-tighter uppercase whitespace-nowrap transition-colors"
            :class="
              selectedDivision === division
                ? 'bg-primary-container text-white'
                : 'bg-surface-container-low text-on-surface hover:bg-surface-container-high'
            "
            @click="selectedDivision = division"
          >
            {{ division }}
          </button>
        </div>

        <div class="flex w-max space-x-4">
          <button
            v-for="disciplineType in disciplineTypes"
            :key="disciplineType"
            type="button"
            class="px-8 py-3 font-headline font-black italic tracking-tighter uppercase whitespace-nowrap transition-colors"
            :class="
              selectedDiscipline === disciplineType
                ? 'bg-primary-container text-white'
                : 'bg-surface-container-low text-on-surface hover:bg-surface-container-high'
            "
            @click="selectedDiscipline = disciplineType"
          >
            {{ disciplineType }}
          </button>
        </div>
      </div>
    </section>

    <section ref="fighterCardsSectionRef" class="px-8 max-w-7xl mx-auto">
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-12 overflow-hidden">
        <NuxtLink
          v-for="(fighter, index) in visibleFighters"
          :key="fighter.id"
          :to="`/fighters/${fighter.id}`"
          class="group relative fighter-card fighter-card-skew bg-surface-container-low overflow-hidden hover:scale-[1.02] transition-all duration-700 ease-out"
          :class="[
            !isMounted || animatedMap[fighter.id]
              ? 'opacity-100 translate-x-0 translate-y-0'
              : isMobileViewport
                ? (index % 2 === 0 ? 'opacity-0 -translate-x-16' : 'opacity-0 translate-x-16')
                : 'opacity-0 translate-y-16',
          ]"
          :style="{ transitionDelay: `${(index % 3) * 100}ms` }"
          :data-fighter-id="fighter.id"
        >
          <div class="h-[500px] relative">
            <img
              :alt="fighter.name"
              loading="lazy"
              decoding="async"
              fetchpriority="low"
              :width="fighter.imageWidth"
              :height="fighter.imageHeight"
              :class="[
                'w-full h-full object-cover transition-all duration-700',
                isMobileViewport && inViewMap[fighter.id]
                  ? 'grayscale-0'
                  : 'grayscale group-hover:grayscale-0',
              ]"
              :src="fighter.image"
            />
            <div
              class="absolute inset-0 bg-gradient-to-t from-surface-container-lowest via-transparent to-transparent opacity-90"
            />
            <div
              v-if="fighter.badges.length > 0"
              class="absolute top-6 left-6 flex flex-col items-start gap-2"
            >
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
              <p
                v-if="fighter.nickname"
                class="text-primary font-headline italic font-black text-xl mb-1 uppercase tracking-tight"
              >
                "{{ fighter.nicknameDisplay }}"
              </p>
              <h3
                class="text-4xl font-headline font-black italic uppercase leading-none tracking-tighter mb-4"
              >
                {{ fighter.name }}
              </h3>
              <div class="flex justify-between items-center border-t border-white/10 pt-4">
                <div>
                  <p class="text-[10px] text-primary uppercase tracking-widest font-bold">RECORD</p>
                  <p
                    class="text-2xl font-headline font-black italic text-on-surface tracking-tighter"
                  >
                    {{ fighter.record }}
                  </p>
                </div>
                <div class="text-right">
                  <p class="text-[10px] text-primary uppercase tracking-widest font-bold">
                    DIVISION
                  </p>
                  <p
                    class="text-lg font-headline font-black italic text-secondary tracking-tighter uppercase"
                  >
                    {{ fighter.division }}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </NuxtLink>
      </div>

      <p
        v-if="filteredFighters.length === 0"
        class="mt-16 text-center text-on-surface-variant uppercase tracking-widest text-sm"
      >
        No fighters match your current filters.
      </p>

      <div v-if="showLoadMore" class="mt-20 flex justify-center">
        <button
          type="button"
          class="group flex items-center gap-4 bg-surface-container-high border border-outline-variant px-12 py-6 font-headline font-black italic tracking-tighter uppercase hover:bg-primary-container hover:text-white transition-all duration-300"
          @click="loadMore"
        >
          {{ loadMoreLabel }}
          <Icon
            name="material-symbols:keyboard-double-arrow-right"
            class="group-hover:translate-x-2 transition-transform"
          />
        </button>
      </div>
    </section>
  </section>
</template>

<style scoped>
.fighter-card {
  content-visibility: auto;
  contain: layout paint style;
  contain-intrinsic-size: 500px;
}

.fighter-card-skew {
  clip-path: polygon(0 0, 100% 0, 100% 90%, 90% 100%, 0 100%);
}

@media (max-width: 1024px) {
  .fighter-card-skew {
    clip-path: none;
  }
}
</style>
