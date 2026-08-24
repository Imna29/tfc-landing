<script setup lang="ts">
/**
 * One labelled field on an account form, with its hint and whatever the server
 * said was wrong with it.
 *
 * Sign-up and sign-in look the same because they are the same form twice, and
 * a fan who has just been turned away from one should not find the other
 * looking like a different site.
 */
defineProps<{
  name: string;
  label: string;
  type: string;
  autocomplete: string;
  hint?: string;
  max?: string;
  problem?: string;
}>();

const value = defineModel<string>({ required: true });
</script>

<template>
  <div class="grid gap-2">
    <label :for="name" class="font-headline text-sm font-black uppercase tracking-widest">
      {{ label }}
    </label>

    <input
      :id="name"
      v-model="value"
      :type="type"
      :autocomplete="autocomplete"
      :max="max"
      :aria-describedby="hint ? `${name}-hint` : undefined"
      :aria-invalid="Boolean(problem)"
      class="bg-surface-container-low border border-outline-variant/40 px-4 py-3 focus:outline-none focus:border-primary"
    />

    <p v-if="hint" :id="`${name}-hint`" class="text-sm text-on-surface/60">{{ hint }}</p>

    <p v-if="problem" class="text-sm text-error" role="alert">{{ problem }}</p>
  </div>
</template>
