<script setup lang="ts">
import { resolveEligibilityRules, type AuthoredEligibilityRule } from "~/utils/eligibilityRules";

const props = defineProps<{
  heading?: string | null;
  authored?: readonly AuthoredEligibilityRule[] | null;
}>();

/**
 * Always renders something. ADR-0007 makes these constraints part of what the
 * contest is, so the page publishes the defaults until someone authors better
 * ones — see `app/utils/eligibilityRules.ts`.
 */
const rules = computed(() => resolveEligibilityRules(props.authored));
</script>

<template>
  <section class="px-6 md:px-20 py-24">
    <div class="max-w-[1440px] mx-auto">
      <h2
        class="font-headline text-4xl md:text-6xl font-black italic uppercase tracking-tighter border-l-4 border-primary-container pl-6 mb-12"
      >
        {{ heading || "Who can play" }}
      </h2>

      <dl class="grid grid-cols-1 md:grid-cols-2 gap-px bg-outline-variant/20">
        <div v-for="rule in rules" :key="rule.id" class="bg-surface-container-low p-10">
          <dt class="font-headline text-2xl font-black italic uppercase mb-4">
            {{ rule.title }}
          </dt>
          <dd v-if="rule.detail" class="text-on-surface/80 leading-relaxed">
            {{ rule.detail }}
          </dd>
        </div>
      </dl>
    </div>
  </section>
</template>
