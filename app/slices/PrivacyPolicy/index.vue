<script setup lang="ts">
import type { Content } from "@prismicio/client";

defineProps(
  getSliceComponentProps<Content.PrivacyPolicySlice>(["slice", "index", "slices", "context"]),
);
</script>

<template>
  <section
    class="px-6 md:px-8"
    :data-slice-type="slice.slice_type"
    :data-slice-variation="slice.variation"
  >
    <div class="max-w-4xl mx-auto rich-text text-on-surface/90 leading-relaxed">
      <PrismicRichText :field="slice.primary.content" />
    </div>
  </section>
</template>

<style scoped>
.rich-text :deep(h1) {
  font-family: var(--font-headline);
  font-size: clamp(2rem, 5vw, 3rem);
  font-weight: 900;
  font-style: italic;
  text-transform: uppercase;
  letter-spacing: -0.04em;
  margin-bottom: 2rem;
  color: #ffffff;
}

.rich-text :deep(h2) {
  font-family: var(--font-headline);
  font-size: clamp(1.5rem, 4vw, 2rem);
  font-weight: 900;
  font-style: italic;
  text-transform: uppercase;
  letter-spacing: -0.04em;
  margin-top: 3rem;
  margin-bottom: 1.5rem;
  color: #ffffff;
}

.rich-text :deep(h3) {
  font-family: var(--font-headline);
  font-size: clamp(1.25rem, 3vw, 1.5rem);
  font-weight: 900;
  font-style: italic;
  text-transform: uppercase;
  letter-spacing: -0.04em;
  margin-top: 2.5rem;
  margin-bottom: 1rem;
  color: #ffffff;
}

.rich-text :deep(p) {
  font-size: clamp(1rem, 2vw, 1.125rem);
  margin-bottom: 1.5rem;
}

.rich-text :deep(ul) {
  list-style-type: disc;
  padding-left: 1.5rem;
  margin-bottom: 1.5rem;
}

.rich-text :deep(ul) > :deep(li) + :deep(li) {
  margin-top: 0.5rem;
}

.rich-text :deep(ol) {
  list-style-type: decimal;
  padding-left: 1.5rem;
  margin-bottom: 1.5rem;
}

.rich-text :deep(ol) > :deep(li) + :deep(li) {
  margin-top: 0.5rem;
}

.rich-text :deep(li) {
  font-size: clamp(1rem, 2vw, 1.125rem);
}

.rich-text :deep(a) {
  color: var(--color-primary-container);
  text-decoration: underline;
}

.rich-text :deep(a):hover {
  text-decoration: none;
}

.rich-text :deep(strong) {
  font-weight: 700;
  color: #ffffff;
}

.rich-text :deep(em) {
  font-style: italic;
}
</style>
