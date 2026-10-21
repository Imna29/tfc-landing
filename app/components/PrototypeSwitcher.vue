<script setup lang="ts">
// PROTOTYPE tooling — throwaway. Floating bar that cycles `?variant=` on the
// current route. Renders nothing outside `nuxt dev`, so a stray merge cannot
// show it to a fan.
const props = defineProps<{ variants: { key: string; name: string }[]; current: string }>();

const route = useRoute();
const router = useRouter();
const enabled = import.meta.dev;

const index = computed(() =>
  Math.max(
    0,
    props.variants.findIndex((v) => v.key === props.current),
  ),
);
const active = computed(() => props.variants[index.value]);

function go(step: number) {
  const n = props.variants.length;
  const next = props.variants[(index.value + step + n) % n];
  if (!next) return;
  router.replace({ query: { ...route.query, variant: next.key } });
}

function onKey(event: KeyboardEvent) {
  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
  const target = event.target as HTMLElement | null;
  if (target?.closest("input, textarea, select, [contenteditable]:not([contenteditable=false])")) {
    return;
  }
  go(event.key === "ArrowLeft" ? -1 : 1);
}

onMounted(() => enabled && window.addEventListener("keydown", onKey));
onBeforeUnmount(() => window.removeEventListener("keydown", onKey));
</script>

<template>
  <div
    v-if="enabled"
    class="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-1 rounded-full bg-[#fef08a] text-black font-mono text-sm shadow-[0_6px_24px_rgba(0,0,0,0.5)] ring-2 ring-black p-1"
  >
    <button
      type="button"
      class="size-8 grid place-items-center rounded-full hover:bg-black/10"
      aria-label="Previous variant"
      @click="go(-1)"
    >
      ←
    </button>
    <span class="px-3 whitespace-nowrap">
      <strong>{{ active?.key }}</strong> ({{ active?.name }})
      <span class="opacity-50">{{ index + 1 }}/{{ variants.length }}</span>
    </span>
    <button
      type="button"
      class="size-8 grid place-items-center rounded-full hover:bg-black/10"
      aria-label="Next variant"
      @click="go(1)"
    >
      →
    </button>
  </div>
</template>
