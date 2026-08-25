<script setup lang="ts">
import { components } from "~/slices";

const { client } = usePrismic();
const route = useRoute();
const { data: page } = await useAsyncData(`en-us/${route.params.uid}`, () =>
  client.getByUID("page", route.params.uid as string, {
    lang: "en-us",
  }),
);

// A uid with no document behind it is a page that is not there. Rendering an
// empty SliceZone with a 200 instead would be a soft 404 — indistinguishable,
// to a reader or a crawler, from a page whose content someone forgot to write.
if (!page.value) {
  throw createError({ statusCode: 404, statusMessage: "Page not found", fatal: true });
}

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
