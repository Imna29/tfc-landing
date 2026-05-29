<script setup lang="ts">
import { components } from "~/slices";

const { client } = usePrismic();
const route = useRoute();
const { data: page } = await useAsyncData(`en-us/${route.params.uid}`, () =>
  client.getByUID("page", route.params.uid as string, {
    lang: "en-us",
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
