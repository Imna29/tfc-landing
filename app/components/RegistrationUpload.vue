<script setup lang="ts">
import { describeBytes, type RegistrationUpload } from "#shared/fighterRegistration";

/**
 * Choosing the files for one of the form's uploads.
 *
 * Nothing is sent from here. The files are held until the fighter registers,
 * so that switching discipline, or fixing an answer the form turned away, does
 * not leave a gigabyte of video sitting in the wrong Drive folder.
 */
const props = defineProps<{
  upload: RegistrationUpload;
  problem?: string;
}>();

const files = defineModel<File[]>({ required: true });

const id = computed(() => `upload-${props.upload.name}`);
const accept = computed(() => props.upload.accept.map((prefix) => `${prefix}*`).join(","));
const full = computed(() => files.value.length >= props.upload.maxFiles);

function add(event: Event) {
  const input = event.target as HTMLInputElement;
  const chosen = Array.from(input.files ?? []);
  const isNew = (file: File) =>
    !files.value.some((held) => held.name === file.name && held.size === file.size);

  // A one-file upload is replaced rather than added to: choosing a second
  // photo means "this one instead".
  files.value =
    props.upload.maxFiles === 1 ? chosen.slice(0, 1) : [...files.value, ...chosen.filter(isNew)];

  // So choosing the same file again, after removing it, still fires `change`.
  input.value = "";
}

function remove(file: File) {
  files.value = files.value.filter((held) => held !== file);
}
</script>

<template>
  <div class="grid gap-3">
    <span :id="`${id}-label`" class="font-headline text-sm font-black uppercase tracking-widest">
      {{ upload.label }}{{ upload.required ? "" : " (optional)" }}
    </span>

    <p :id="`${id}-hint`" class="text-sm text-on-surface/60">{{ upload.hint }}</p>

    <ul v-if="files.length" class="grid gap-2">
      <li
        v-for="file in files"
        :key="`${file.name}-${file.size}`"
        class="flex items-center justify-between gap-4 border border-outline-variant/40 px-4 py-3"
      >
        <span class="truncate">{{ file.name }}</span>
        <span class="flex shrink-0 items-center gap-4">
          <span class="text-sm text-on-surface/60">{{ describeBytes(file.size) }}</span>
          <button
            type="button"
            class="text-sm font-bold uppercase tracking-widest hover:text-primary"
            :aria-label="`Remove ${file.name}`"
            @click="remove(file)"
          >
            Remove
          </button>
        </span>
      </li>
    </ul>

    <label
      v-if="!full || upload.maxFiles === 1"
      :for="id"
      class="flex items-center justify-center gap-3 border border-dashed border-outline-variant/60 px-4 py-6 cursor-pointer hover:border-primary has-focus-visible:border-primary"
    >
      <Icon name="material-symbols:upload" class="text-2xl text-primary" />
      <span class="font-bold uppercase text-sm tracking-widest">
        {{
          upload.maxFiles > 1
            ? "Choose files"
            : files.length
              ? "Choose a different file"
              : "Choose a file"
        }}
      </span>
      <input
        :id="id"
        type="file"
        class="sr-only"
        :accept="accept"
        :multiple="upload.maxFiles > 1"
        :aria-labelledby="`${id}-label`"
        :aria-describedby="`${id}-hint`"
        @change="add"
      />
    </label>

    <p v-if="problem" class="text-sm text-error" role="alert">{{ problem }}</p>
  </div>
</template>
