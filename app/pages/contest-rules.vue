<script setup lang="ts">
import { components } from "~/slices";

const { data: page } = await useOptionalSingle("contest_rules");

useSeoMeta({
  title: () => page.value?.data.meta_title || "Contest rules",
  description: () =>
    page.value?.data.meta_description ||
    "Who can take part in a TFC Predictions Season, and the terms prizes are awarded under.",
  ogTitle: () => page.value?.data.meta_title || "Contest rules",
  ogImage: () => page.value?.data.meta_image?.url || null,
});
</script>

<template>
  <PageHeading :text="page?.data.title || 'Contest rules'" />

  <EligibilityRules
    :heading="page?.data.eligibility_heading"
    :authored="page?.data.eligibility_rules"
  />

  <SliceZone :slices="page?.data.slices ?? []" :components="components" />

  <PageCrossLink to="/prizes" heading="What a Season is played for" label="See the prizes" />
</template>
