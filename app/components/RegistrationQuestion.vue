<script setup lang="ts">
import type { RegistrationQuestion } from "#shared/fighterRegistration";

/**
 * One question on the Fighter Registration form, with the hint the Google
 * Form carried under it and whatever was wrong with the answer.
 *
 * Styled as `AccountField` is, so the two forms on the site read as one site.
 * A `choices` question is ticked boxes and an "Other" line, the way the form
 * offered them: `v-model` is what was ticked and `v-model:other` what was
 * typed.
 */
const props = defineProps<{
  question: RegistrationQuestion;
  problem?: string;
}>();

const value = defineModel<string>({ default: "" });
const ticked = defineModel<string[]>("ticked", { default: () => [] });
const other = defineModel<string>("other", { default: "" });

const id = computed(() => `question-${props.question.field}`);
const hintId = computed(() => (props.question.hint ? `${id.value}-hint` : undefined));

const inputType = computed(() => {
  switch (props.question.kind) {
    case "email":
      return "email";
    case "tel":
      return "tel";
    case "date":
      return "date";
    default:
      return "text";
  }
});

const fieldClass =
  "bg-surface-container-low border border-outline-variant/40 px-4 py-3 focus:outline-none focus:border-primary";
</script>

<template>
  <fieldset v-if="question.kind === 'choices'" class="grid gap-3" :aria-describedby="hintId">
    <legend class="font-headline text-sm font-black uppercase tracking-widest mb-2">
      {{ question.label }}
    </legend>

    <p v-if="question.hint" :id="hintId" class="text-sm text-on-surface/60">{{ question.hint }}</p>

    <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
      <label
        v-for="choice in question.choices"
        :key="choice"
        class="flex items-center gap-3 border border-outline-variant/40 px-4 py-3 cursor-pointer has-checked:border-primary"
      >
        <input v-model="ticked" type="checkbox" :value="choice" class="accent-primary w-4 h-4" />
        <span>{{ choice }}</span>
      </label>
    </div>

    <input
      v-model="other"
      type="text"
      :aria-label="`${question.label}: other`"
      placeholder="Other"
      :class="fieldClass"
    />

    <p v-if="problem" class="text-sm text-error" role="alert">{{ problem }}</p>
  </fieldset>

  <div v-else class="grid gap-2">
    <label :for="id" class="font-headline text-sm font-black uppercase tracking-widest">
      {{ question.label }}
    </label>

    <textarea
      v-if="question.kind === 'paragraph'"
      :id="id"
      v-model="value"
      rows="5"
      :aria-describedby="hintId"
      :aria-invalid="Boolean(problem)"
      :class="[fieldClass, 'resize-y']"
    />

    <input
      v-else
      :id="id"
      v-model="value"
      :type="inputType"
      :autocomplete="question.autocomplete ?? 'off'"
      :aria-describedby="hintId"
      :aria-invalid="Boolean(problem)"
      :class="fieldClass"
    />

    <p v-if="question.hint" :id="hintId" class="text-sm text-on-surface/60">{{ question.hint }}</p>

    <p v-if="problem" class="text-sm text-error" role="alert">{{ problem }}</p>
  </div>
</template>
