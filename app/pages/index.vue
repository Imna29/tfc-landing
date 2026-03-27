<script setup lang="ts">
import { components } from "~/slices";
const { locale } = useI18n();

const { client } = usePrismic();
const route = useRoute();
const { data: page } = await useAsyncData(`${locale.value}/home_page`, () =>
  client.getSingle("home_page", {
    lang: locale.value,
  }),
);

definePageMeta({
  withHeaderProfile: true,
  withHeaderDivider: true,
  withFooterSignUpForm: true,
});

useHead({
  title: computed(() => page.value?.data.meta_title),
});
</script>

<template>
  <main>
    <SliceZone :slices="page?.data.slices ?? []" :components="components" />
  </main>
</template>
