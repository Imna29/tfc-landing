<script setup lang="ts">
import { components } from "~/slices";

const { locale } = useI18n();
const { client } = usePrismic();

const { data: page } = await useAsyncData(`${locale.value}/fighters`, () =>
  client.getByUID("page", "fighters", {
    lang: locale.value,
  }),
);

definePageMeta({
  withHeaderProfile: true,
  withHeaderDivider: true,
  withFooterSignUpForm: true,
});

useHead({
  title: computed(() => page.value?.data.meta_title || "Fighters | Tbilisi Fighting Championship"),
});
</script>

<template>
  <main>
    <SliceZone :slices="page?.data.slices ?? []" :components="components" />
  </main>
</template>
