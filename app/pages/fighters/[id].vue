<script setup lang="ts">
import { isFilled } from "@prismicio/client";
import type { Content } from "@prismicio/client";

const PLACEHOLDER_IMAGE = "/fighter-placeholder.svg";
const FALLBACK_STAT_VALUE = "\u2014";

interface Fight {
  result: string;
  date: string;
  opponent: string;
  event: string;
  method: string;
  round: string;
  youtubeHtml: string | null;
}

interface FighterSpec {
  label: string;
  value: string;
}

interface FighterProfile {
  id: string;
  name: string;
  nickname: string;
  record: string;
  division: string;
  image: string;
  specs: FighterSpec[];
  history: Content.FighterDocument["data"]["history"];
  fights: Fight[];
  gallery: { src: string; alt: string }[];
  links: {
    instagram: string | null;
    tapology: string | null;
  };
}

const route = useRoute();
const { client } = usePrismic();
const { locale } = useI18n();

const fighterIdParam = route.params.id;
const fighterId = Array.isArray(fighterIdParam)
  ? (fighterIdParam[0] ?? "")
  : typeof fighterIdParam === "string"
    ? fighterIdParam
    : "";

const { data: fighterDocument } = await useAsyncData(
  `${locale.value}/fighter/${fighterId}`,
  async () => {
    if (!fighterId) {
      return null;
    }

    try {
      return await client.getByUID("fighter", fighterId, {
        lang: locale.value,
      });
    } catch (error) {
      if ((error as { status?: number }).status === 404) {
        return null;
      }

      throw error;
    }
  },
);

if (!fighterDocument.value) {
  throw createError({
    statusCode: 404,
    statusMessage: "Fighter not found",
    fatal: true,
  });
}

const getLinkUrl = (linkField: unknown): string | null => {
  if (!linkField || typeof linkField !== "object") {
    return null;
  }

  const normalizedLinkField = linkField as {
    url?: unknown;
    text?: unknown;
  };

  const url = normalizedLinkField.url;
  const text = normalizedLinkField.text;

  if (typeof url === "string" && url.trim()) {
    return url.trim();
  }

  if (typeof text === "string" && text.trim()) {
    return text.trim();
  }

  return null;
};

const getDivisionName = (divisionField: Content.FighterDocument["data"]["division"]): string => {
  if (isFilled.contentRelationship(divisionField) && divisionField.data?.name) {
    return divisionField.data.name;
  }

  return "UNKNOWN DIVISION";
};

const getCombatArchive = (
  archiveField: Content.FighterDocument["data"]["combat_archive"] | undefined | null,
  name: string,
): FighterProfile["gallery"] => {
  if (!archiveField) {
    return [];
  }

  const archiveItems: FighterProfile["gallery"] = [];

  archiveField.forEach((item, index) => {
    if (!isFilled.image(item.image) || !item.image.url) {
      return;
    }

    archiveItems.push({
      src: item.image.url,
      alt: `${name} archive image ${index + 1}`,
    });
  });

  return archiveItems;
};

const fighter = computed<FighterProfile>(() => {
  const currentFighter = fighterDocument.value!;
  const fighterData = currentFighter.data;
  const fighterName = fighterData.name?.trim() || "Unknown Fighter";
  const primaryImage =
    isFilled.image(fighterData.image) && fighterData.image.url
      ? fighterData.image.url
      : PLACEHOLDER_IMAGE;
  const bannerImage =
    isFilled.image(fighterData.banner_image) && fighterData.banner_image.url
      ? fighterData.banner_image.url
      : primaryImage;
  const combatArchive = getCombatArchive(fighterData.combat_archive, fighterName);

  const specs: FighterSpec[] = [
    { label: "Height", value: fighterData.height?.trim() },
    { label: "Reach", value: fighterData.reach?.trim() },
    {
      label: "Age",
      value:
        fighterData.age !== null && fighterData.age !== undefined
          ? `${fighterData.age}`
          : undefined,
    },
    { label: "Gym", value: fighterData.gym?.trim() },
    { label: "NATIONALITY", value: fighterData.from?.trim() },
  ].filter((spec): spec is FighterSpec => Boolean(spec.value));

  return {
    id: currentFighter.uid || currentFighter.id,
    name: fighterName,
    nickname: fighterData.nickname?.trim() || "",
    record: fighterData.record?.trim() || FALLBACK_STAT_VALUE,
    division: getDivisionName(fighterData.division),
    image: bannerImage,
    specs,
    history: fighterData.history,
    fights: (fighterData.recent_battles ?? []).map((fight) => ({
      result: fight.result?.trim() || FALLBACK_STAT_VALUE,
      date: fight.date?.trim() || FALLBACK_STAT_VALUE,
      opponent: fight.opponent?.trim() || FALLBACK_STAT_VALUE,
      event: fight.event?.trim() || FALLBACK_STAT_VALUE,
      method: fight.method?.trim() || FALLBACK_STAT_VALUE,
      round: fight.round?.trim() || FALLBACK_STAT_VALUE,
      youtubeHtml: fight.youtube_link?.html ?? null,
    })),
    gallery: combatArchive,
    links: {
      instagram: getLinkUrl(fighterData.instagram_link),
      tapology: getLinkUrl(fighterData.tapology_link),
    },
  };
});

const fighterNameParts = computed(() => {
  const nameParts = fighter.value.name
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean);

  if (nameParts.length === 0) {
    return {
      firstName: "",
      lastName: "",
    };
  }

  return {
    firstName: nameParts[0]!.toUpperCase(),
    lastName: nameParts.slice(1).join(" ").toUpperCase(),
  };
});

useHead({
  title: computed(() => `${fighter.value.name} | Tbilisi Fighting Championship`),
});

const selectedVideo = ref<{ title: string; html: string } | null>(null);
const isOpen = shallowRef(false);

const openVideoModal = (video: { title: string; html: string }) => {
  selectedVideo.value = video;
  isOpen.value = true;
};

const closeVideoModal = () => {
  selectedVideo.value = null;
  isOpen.value = false;
};
</script>

<template>
  <main>
    <section class="relative min-h-[870px] flex items-center overflow-hidden">
      <div class="absolute inset-0 z-0">
        <img
          :alt="fighter.name"
          loading="eager"
          decoding="async"
          fetchpriority="high"
          class="w-full h-full object-cover object-center grayscale"
          :src="fighter.image"
        />
        <div class="absolute inset-0 hero-gradient" />
      </div>

      <div class="relative z-10 px-8 md:px-20 w-full max-w-7xl mx-auto">
        <div class="flex flex-col gap-2">
          <span class="text-primary font-headline font-bold tracking-[0.3em] uppercase">{{
            fighter.division
          }}</span>
          <h1
            class="text-7xl md:text-9xl font-headline font-black italic tracking-tighter leading-none text-white"
          >
            {{ fighterNameParts.firstName }} <br />
            <span v-if="fighter.nickname" class="text-primary-container"
              >"{{ fighter.nickname.toUpperCase() }}"</span
            >
            <br v-if="fighter.nickname" />
            {{ fighterNameParts.lastName }}
          </h1>
          <div class="flex items-baseline gap-6 mt-8">
            <div class="flex flex-col">
              <span class="text-secondary-fixed-dim text-xs font-bold uppercase tracking-widest"
                >RECORD</span
              >
              <span class="text-4xl font-headline font-black italic italic">{{
                fighter.record
              }}</span>
            </div>
          </div>
        </div>
      </div>

      <div
        class="absolute bottom-0 right-0 w-1/2 h-24 bg-primary-container slanted-mask opacity-20 transform translate-y-12 translate-x-12"
      />
    </section>

    <section class="px-8 py-24 max-w-7xl mx-auto">
      <div class="grid grid-cols-1 md:grid-cols-12 gap-6">
        <div class="md:col-span-4 bg-surface-container-low p-8 border-l-4 border-primary-container">
          <h3 class="font-headline font-black italic text-2xl mb-8 uppercase tracking-tighter">
            Fighter Specs
          </h3>
          <div class="space-y-6">
            <div
              v-for="spec in fighter.specs"
              :key="spec.label"
              class="flex justify-between items-end border-b border-outline-variant/20 pb-2"
            >
              <span class="text-secondary-fixed-dim uppercase text-sm font-bold tracking-widest">{{
                spec.label
              }}</span>
              <span class="text-xl font-headline font-bold">{{ spec.value }}</span>
            </div>
          </div>
        </div>

        <div class="md:col-span-8 bg-surface-container-lowest p-8 md:p-12 relative overflow-hidden">
          <div class="absolute top-0 right-0 p-4 opacity-5 pointer-events-none select-none">
            <span class="text-[12rem] font-headline font-black italic leading-none">GEO</span>
          </div>
          <h3 class="font-headline font-black italic text-2xl mb-6 uppercase tracking-tighter">
            The Warrior's Path
          </h3>
          <div class="max-w-2xl warrior-path-rich-text">
            <PrismicRichText :field="fighter.history" />
          </div>
          <div class="flex gap-4 mt-10">
            <a
              class="inline-block hover:opacity-80 transition-opacity"
              :href="fighter.links.instagram || '#'"
              :aria-disabled="!fighter.links.instagram"
              :tabindex="fighter.links.instagram ? 0 : -1"
              :target="fighter.links.instagram ? '_blank' : undefined"
              :rel="fighter.links.instagram ? 'noopener noreferrer' : undefined"
            >
              <img src="/Instagram_icon.png" alt="Instagram" class="h-auto w-auto max-h-10" />
            </a>
            <a
              class="inline-block hover:opacity-80 transition-opacity"
              :href="fighter.links.tapology || '#'"
              :aria-disabled="!fighter.links.tapology"
              :tabindex="fighter.links.tapology ? 0 : -1"
              :target="fighter.links.tapology ? '_blank' : undefined"
              :rel="fighter.links.tapology ? 'noopener noreferrer' : undefined"
            >
              <img
                src="/tapology.jpg"
                alt="Tapology"
                class="h-auto w-auto max-h-10 rounded-full object-cover"
              />
            </a>
          </div>
        </div>
      </div>
    </section>

    <section class="bg-surface-container-lowest py-24">
      <div class="px-8 max-w-7xl mx-auto">
        <div class="flex items-center justify-between mb-16">
          <h2 class="text-5xl font-headline font-black italic uppercase tracking-tighter">
            Recent Battles
          </h2>
          <div class="h-[2px] flex-1 bg-outline-variant/20 mx-8" />
        </div>

        <div class="space-y-4">
          <div
            v-for="fight in fighter.fights"
            :key="fight.opponent"
            class="group flex flex-col md:flex-row items-center bg-surface-container-low hover:bg-surface-container-high transition-all p-6 relative overflow-hidden"
          >
            <div class="absolute left-0 top-0 bottom-0 w-2 bg-primary-container" />
            <div class="flex-1 flex items-center gap-8 mb-4 md:mb-0">
              <div class="text-center">
                <span class="block text-2xl font-headline font-black italic">{{
                  fight.result
                }}</span>
                <span class="text-[10px] uppercase font-bold text-secondary-fixed-dim">{{
                  fight.date
                }}</span>
              </div>
              <div>
                <h4 class="text-2xl font-headline font-black italic uppercase">
                  {{ fight.opponent }}
                </h4>
                <p class="text-sm text-on-surface-variant uppercase tracking-widest">
                  {{ fight.event }}
                </p>
              </div>
            </div>
            <div class="flex items-center gap-12">
              <div class="text-right">
                <span class="block font-bold text-primary italic">{{ fight.method }}</span>
                <span class="text-xs text-secondary-fixed-dim uppercase">{{ fight.round }}</span>
              </div>
              <button
                v-if="fight.youtubeHtml"
                class="cursor-pointer bg-white/5 p-3 group-hover:bg-primary-container transition-colors"
                @click="
                  openVideoModal({
                    title: `${fight.opponent} vs ${fighter.name}`,
                    html: fight.youtubeHtml!,
                  })
                "
              >
                <Icon
                  name="material-symbols:smart-display"
                  class="text-white text-2xl"
                  style="font-variation-settings: &quot;FILL&quot; 1"
                />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section v-if="fighter.gallery.length > 0" class="py-24 px-8 max-w-7xl mx-auto">
      <h3 class="font-headline font-black italic text-4xl mb-12 uppercase tracking-tighter">
        Combat Archive
      </h3>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div
          v-for="image in fighter.gallery"
          :key="image.alt"
          class="aspect-square bg-surface-container-high relative group overflow-hidden"
        >
          <img
            :alt="image.alt"
            loading="lazy"
            decoding="async"
            fetchpriority="low"
            class="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-500 scale-110 group-hover:scale-100"
            :src="image.src"
          />
          <div
            class="absolute inset-0 bg-primary-container/20 opacity-0 group-hover:opacity-100 transition-opacity"
          />
        </div>
      </div>
    </section>

    <section class="bg-primary-container py-20 px-8 text-center relative overflow-hidden">
      <div class="absolute inset-0 opacity-10 pointer-events-none">
        <div class="grid grid-cols-6 h-full w-full">
          <div class="border-r border-on-primary" />
          <div class="border-r border-on-primary" />
          <div class="border-r border-on-primary" />
          <div class="border-r border-on-primary" />
          <div class="border-r border-on-primary" />
          <div class="border-r border-on-primary" />
        </div>
      </div>
      <div class="relative z-10 max-w-3xl mx-auto">
        <h2
          class="text-5xl md:text-7xl font-headline font-black italic uppercase tracking-tighter mb-8 leading-tight"
        >
          Witness the Next Title Defense
        </h2>
        <div class="flex flex-col md:flex-row gap-4 justify-center">
          <button
            class="bg-on-primary-container text-primary-container font-headline font-black italic px-12 py-4 uppercase text-xl hover:scale-105 transition-transform"
          >
            Get Tickets Now
          </button>
          <button
            class="border-2 border-on-primary-container text-on-primary-container font-headline font-black italic px-12 py-4 uppercase text-xl hover:bg-on-primary-container/10 transition-colors"
          >
            Fight Schedule
          </button>
        </div>
      </div>
    </section>

    <Teleport to="body">
      <div
        v-if="isOpen"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
        @click="closeVideoModal"
      >
        <div class="relative w-[90vw] max-w-5xl" @click.stop>
          <button
            class="absolute -top-10 right-0 text-white hover:text-primary transition-colors"
            @click="closeVideoModal"
          >
            <Icon name="material-symbols:close" class="text-3xl" />
          </button>
          <div v-if="selectedVideo?.html" class="youtube-video" v-html="selectedVideo.html" />
        </div>
      </div>
    </Teleport>
  </main>
</template>

<style scoped>
.hero-gradient {
  background:
    linear-gradient(to right, rgba(19, 19, 19, 0.7) 20%, transparent 60%),
    linear-gradient(to top, rgba(19, 19, 19, 0.6) 10%, transparent 40%);
}
.slanted-mask {
  clip-path: polygon(10% 0, 100% 0, 90% 100%, 0% 100%);
}
.warrior-path-rich-text :deep(p:first-child) {
  font-size: 1.125rem;
  line-height: 1.625;
  color: rgb(var(--md-sys-color-on-surface-variant));
  margin-bottom: 1.5rem;
  font-style: italic;
}
.warrior-path-rich-text :deep(p) {
  color: rgb(var(--md-sys-color-on-surface-variant));
  line-height: 1.625;
}
</style>

<style>
.youtube-video {
  width: 100%;
  height: 100%;
  position: relative;
}

.youtube-video > iframe {
  width: 100%;
  height: 100%;
  aspect-ratio: 16 / 9;
}
</style>
