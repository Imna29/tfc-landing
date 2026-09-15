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
    <RichTextBlock :field="slice.primary.content" />
  </section>
</template>
