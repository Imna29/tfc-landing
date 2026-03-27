<script setup lang="ts">
import { isFilled } from "@prismicio/client";
import { asDate } from "@prismicio/client";
import type { Content } from "@prismicio/client";

defineProps(
  getSliceComponentProps<Content.LatestNewsSlice>(["slice", "index", "slices", "context"]),
);
</script>

<template>
  <section
    class="py-24 px-6 md:px-20 container mx-auto"
    :data-slice-type="slice.slice_type"
    :data-slice-variation="slice.variation"
  >
    <h2 class="font-headline text-5xl font-black italic uppercase tracking-tighter mb-12 border-b-8 border-primary-container inline-block leading-none">
      {{ slice.primary.title }}
    </h2>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-12">
      <article
        v-for="(article, index) in slice.primary.articles"
        :key="index"
        class="flex flex-col"
      >
        <div class="bg-surface-container-highest mb-6 overflow-hidden">
          <img
            v-if="isFilled.image(article.image)"
            :alt="article.title || 'Article'"
            class="w-full h-48 object-cover grayscale hover:grayscale-0 transition-all"
            :src="article.image.url"
          >
        </div>
        <time class="text-primary font-black uppercase text-xs mb-2">
          {{ asDate(article.date)?.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) }}
        </time>
        <component
          :is="isFilled.link(article.article_link) ? 'a' : 'div'"
          v-bind="isFilled.link(article.article_link) ? { href: article.article_link.url, target: article.article_link.target } : {}"
        >
          <h3 class="font-headline text-2xl font-black italic uppercase leading-tight mb-4 hover:text-primary transition-colors cursor-pointer">
            {{ article.title }}
          </h3>
        </component>
        <p class="text-on-surface-variant line-clamp-3">{{ article.excerpt }}</p>
      </article>
    </div>
  </section>
</template>