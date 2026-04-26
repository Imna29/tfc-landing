<script setup lang="ts">
import { isFilled } from "@prismicio/client";
import type { Content } from "@prismicio/client";
import { computed, nextTick, onMounted, onUnmounted, ref } from "vue";

const props = defineProps(
  getSliceComponentProps<Content.TheArchitectsSlice>(["slice", "index", "slices", "context"]),
);

const leaders = computed(() => {
  return props.slice.primary.main.map((leader, index) => {
    const matchingExtra = props.slice.primary.more.find((item) => item.name === leader.name);
    const fallbackExtra = props.slice.primary.more[index];

    return {
      id: `${leader.name ?? "leader"}-${index}`,
      name: leader.name,
      role: leader.position,
      title: matchingExtra?.position || fallbackExtra?.position || "",
      image: leader.image,
    };
  });
});

const sectionRef = ref<HTMLElement | null>(null);
const cardStates = ref<Record<string, boolean>>({});
const isMobileViewport = ref(false);
const isHeaderInView = ref(false);

let mobileViewportQuery: MediaQueryList | null = null;
let cardObserver: IntersectionObserver | null = null;
let headerObserver: IntersectionObserver | null = null;

const initializeObservers = () => {
  cardObserver?.disconnect();
  cardObserver = null;

  const leaderCards = sectionRef.value?.querySelectorAll<HTMLElement>("[data-leader-id]");
  if (!leaderCards?.length) return;

  leaderCards.forEach((card, index) => {
    const id = card.dataset.leaderId;
    if (!id) return;

    const rect = card.getBoundingClientRect();
    const isAboveFold = rect.top < window.innerHeight && rect.bottom > 0;

    if (isAboveFold) {
      setTimeout(() => {
        cardStates.value[id] = true;
      }, index * 100);
    }
  });

  cardObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const el = entry.target as HTMLElement;
          const id = el.dataset.leaderId;
          const index = Array.from(leaderCards).indexOf(el);

          if (id) {
            setTimeout(() => {
              cardStates.value[id] = true;
            }, index * 100);
          }
          cardObserver?.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
  );

  leaderCards.forEach((card) => {
    const id = card.dataset.leaderId;
    if (!id || !cardStates.value[id]) {
      cardObserver?.observe(card);
    }
  });
};

const handleViewportChange = () => {
  isMobileViewport.value = mobileViewportQuery?.matches ?? false;
};

onMounted(async () => {
  mobileViewportQuery = window.matchMedia("(max-width: 767px)");
  mobileViewportQuery.addEventListener("change", handleViewportChange);
  isMobileViewport.value = mobileViewportQuery.matches;

  await nextTick();
  initializeObservers();

  if (sectionRef.value) {
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
  }
});

onUnmounted(() => {
  mobileViewportQuery?.removeEventListener("change", handleViewportChange);
  cardObserver?.disconnect();
  headerObserver?.disconnect();
});
</script>

<template>
  <section
    ref="sectionRef"
    class="py-32 px-8 bg-surface-container-low"
    :data-slice-type="slice.slice_type"
    :data-slice-variation="slice.variation"
  >
    <div class="max-w-7xl mx-auto">
      <h2
        data-section-header
        class="font-headline text-5xl font-black italic uppercase tracking-tighter mb-20 text-center mma-fade-up"
        :class="{ 'mma-active': isHeaderInView }"
      >
        {{ slice.primary.title }}
      </h2>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-12">
        <div
          v-for="(leader, index) in leaders"
          :key="leader.id"
          class="group space-y-6 text-center md:text-left hover:scale-[1.02] transition-all duration-700 ease-out"
          :class="[
            'mma-fade-up',
            { 'mma-active': cardStates[leader.id] }
          ]"
          :style="{ transitionDelay: `${(index % 3) * 100}ms` }"
          :data-leader-id="leader.id"
        >
          <div
            class="aspect-[3/4] bg-surface-container-highest overflow-hidden relative transition-all duration-500"
          >
            <img
              v-if="isFilled.image(leader.image)"
              :alt="leader.image.alt || leader.name || 'Leader'"
              :class="[
                'w-full h-full object-cover transition-all duration-500',
                isMobileViewport ? (cardStates[leader.id] ? 'grayscale-0' : 'grayscale') : '',
              ]"
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
