<script setup lang="ts">
import { components } from "~/slices";

const { data: page } = await useOptionalSingle("prizes");

useSeoMeta({
  title: () => page.value?.data.meta_title || "Prizes",
  description: () =>
    page.value?.data.meta_description ||
    "What the top finishers of a TFC Predictions Season receive, and when the Season closes.",
  ogTitle: () => page.value?.data.meta_title || "Prizes",
  ogImage: () => page.value?.data.meta_image?.url || null,
});
</script>

<template>
  <PageHeading :text="page?.data.title || 'Prizes'" />

  <SeasonDeadline
    :season-name="page?.data.season_name"
    :ends-at="page?.data.season_ends_at"
    :note="page?.data.season_deadline_note"
  />

  <SliceZone :slices="page?.data.slices ?? []" :components="components" />

  <PageCrossLink
    to="/contest-rules"
    heading="Check you qualify before you play"
    label="Read the contest rules"
  />
</template>
