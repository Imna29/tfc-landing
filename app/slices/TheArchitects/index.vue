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
const inViewMap = ref<Record<string, boolean>>({});
const animatedMap = ref<Record<string, boolean>>({});
const isMobileViewport = ref(false);
const isMounted = ref(false);

let mobileViewportQuery: MediaQueryList | null = null;
let observer: IntersectionObserver | null = null;
let animationObserver: IntersectionObserver | null = null;

const initializeMobileObserver = () => {
  const shouldObserve = mobileViewportQuery?.matches ?? false;
  isMobileViewport.value = shouldObserve;

  observer?.disconnect();
  observer = null;
  inViewMap.value = {};

  if (!shouldObserve) {
    return;
  }

  const leaderCards = sectionRef.value?.querySelectorAll<HTMLElement>("[data-leader-id]");
  if (!leaderCards?.length) {
    return;
  }

  observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const leaderId = (entry.target as HTMLElement).dataset.leaderId;
        if (!leaderId) {
          return;
        }

        inViewMap.value[leaderId] = entry.isIntersecting;
      });
    },
    {
      threshold: 0.45,
    },
  );

  leaderCards.forEach((card) => observer?.observe(card));
};

const handleViewportChange = () => {
  initializeMobileObserver();
};

const initializeAnimationObserver = () => {
  animationObserver?.disconnect();
  animationObserver = null;

  const leaderCards = sectionRef.value?.querySelectorAll<HTMLElement>("[data-leader-id]");
  if (!leaderCards?.length) {
    return;
  }

  leaderCards.forEach((card) => {
    const rect = card.getBoundingClientRect();
    const isInViewport = rect.top < window.innerHeight && rect.bottom > 0;
    const leaderId = card.dataset.leaderId;
    if (isInViewport && leaderId) {
      animatedMap.value[leaderId] = true;
    }
  });

  animationObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const leaderId = (entry.target as HTMLElement).dataset.leaderId;
          if (leaderId) {
            animatedMap.value[leaderId] = true;
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

  leaderCards.forEach((card) => {
    const leaderId = card.dataset.leaderId;
    if (leaderId && !animatedMap.value[leaderId]) {
      animationObserver?.observe(card);
    }
  });
};

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

      <div ref="sectionRef" class="grid grid-cols-1 md:grid-cols-3 gap-12">
        <div
          v-for="(leader, index) in leaders"
          :key="leader.id"
          class="group space-y-6 text-center md:text-left hover:scale-[1.02] transition-all duration-700 ease-out"
          :class="[
            !isMounted || animatedMap[leader.id]
              ? 'opacity-100 translate-x-0 translate-y-0'
              : isMobileViewport
                ? (index % 2 === 0 ? 'opacity-0 -translate-x-16' : 'opacity-0 translate-x-16')
                : 'opacity-0 translate-y-16',
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
                isMobileViewport ? (inViewMap[leader.id] ? 'grayscale-0' : 'grayscale') : '',
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
