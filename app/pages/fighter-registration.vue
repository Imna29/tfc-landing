<script setup lang="ts">
import { DISCIPLINE_LABELS, DISCIPLINES, type Discipline } from "#shared/fightCard";
import {
  checkFiles,
  disciplineFrom,
  parseAnswers,
  REGISTRATION_FORMS,
  REGISTRATION_MESSAGES,
  type Answers,
  type RegistrationField,
  type RegistrationProblem,
  type UploadName,
} from "#shared/fighterRegistration";
import { sendToDrive } from "~/utils/driveUpload";

/**
 * Fighter Registration: the three Google Forms TFC used to recruit through —
 * MMA, CageBox and Cage Grappling — as one page with a switch between them.
 *
 * Every registration still lands as a row on that discipline's form's
 * response sheet, with its uploads in Drive; see `shared/fighterRegistration.ts`
 * for how a question finds its column, and `apps-script/fighter-registration/`
 * for what writes it.
 *
 * Registering happens in two steps, because the files cannot pass through this
 * site's server: each file is uploaded straight to Drive first, and then the
 * answers are sent along with the ids Drive gave the files. The answers are
 * checked before any file goes up, by the same code the server checks them
 * with.
 */
useSeoMeta({
  title: "Fighter Registration | TFC — Tbilisi Fighting Championship",
  description:
    "Register to fight for Tbilisi Fighting Championship in MMA, CageBox or Cage Grappling.",
});

const route = useRoute();
const router = useRouter();

const discipline = ref<Discipline>("mma");
const form = computed(() => REGISTRATION_FORMS[discipline.value]);

// Read after mounting rather than during setup. The page is edge-cached, and
// the Function that renders it is not handed the query string, so the server
// always renders MMA; reading the query during setup would render a different
// form in the browser than the HTML it is hydrating.
onMounted(() => {
  discipline.value = disciplineFrom(route.query.discipline) ?? discipline.value;
});

watch(discipline, (picked) => {
  problems.value = {};
  router.replace({ query: { ...route.query, discipline: picked } });
});

// One set of answers across all three forms: most questions are on every one
// of them, and a fighter who switches discipline should not type their name
// again.
const answers = reactive<Record<Exclude<RegistrationField, "fightingStyles">, string>>({
  fullName: "",
  email: "",
  dateOfBirth: "",
  fighterName: "",
  city: "",
  instagram: "",
  phone: "",
  physical: "",
  weightClass: "",
  experience: "",
  gym: "",
  record: "",
  otherExperience: "",
  goal: "",
  referral: "",
});
const fightingStyles = ref<string[]>([]);
const otherFightingStyle = ref("");
const files = reactive<Record<UploadName, File[]>>({ highlights: [], photo: [] });

// Hidden from people; see `server/api/fighter-registration/index.post.ts`.
const website = ref("");

const problems = ref<Partial<Record<RegistrationProblem["field"], string>>>({});
const failure = ref("");
const stage = ref<"filling" | "uploading" | "registering" | "registered">("filling");
const uploadedShare = ref(0);

const busy = computed(() => stage.value === "uploading" || stage.value === "registering");

function given(): Answers {
  return {
    ...answers,
    fightingStyles: [...fightingStyles.value, otherFightingStyle.value],
  };
}

function report(found: RegistrationProblem[]) {
  // The first problem a question has is the one shown beside it.
  problems.value = Object.fromEntries(
    [...found].reverse().map((problem) => [problem.field, problem.message]),
  );

  nextTick(() => document.querySelector('[role="alert"]')?.scrollIntoView({ block: "center" }));
}

async function register() {
  problems.value = {};
  failure.value = "";

  const found = [...parseAnswers(form.value, given()).problems, ...checkFiles(form.value, files)];

  if (found.length > 0) return report(found);

  stage.value = "uploading";
  uploadedShare.value = 0;

  try {
    const uploaded = await uploadEverything();

    stage.value = "registering";

    await $fetch("/api/fighter-registration", {
      method: "POST",
      body: {
        discipline: discipline.value,
        answers: given(),
        files: uploaded,
        website: website.value,
      },
    });

    stage.value = "registered";
    window.scrollTo({ top: 0 });
  } catch (error) {
    stage.value = "filling";

    const data = (error as { data?: { problems?: RegistrationProblem[]; message?: string } }).data;

    if (data?.problems?.length) {
      report(data.problems);
    } else {
      failure.value =
        data?.message === REGISTRATION_MESSAGES.unavailable
          ? REGISTRATION_MESSAGES.unavailable
          : REGISTRATION_MESSAGES.failed;
    }
  }
}

/** Every chosen file, sent to Drive one after another, as the ids Drive gave them. */
async function uploadEverything(): Promise<Record<UploadName, string[]>> {
  const uploaded: Record<UploadName, string[]> = { highlights: [], photo: [] };
  const chosen = form.value.uploads.flatMap((upload) =>
    files[upload.name].map((file) => ({ upload: upload.name, file })),
  );
  const totalBytes = chosen.reduce((sum, { file }) => sum + file.size, 0);
  let sentBefore = 0;

  for (const { upload, file } of chosen) {
    const { uploadUrl } = await $fetch<{ uploadUrl: string }>("/api/fighter-registration/uploads", {
      method: "POST",
      body: {
        discipline: discipline.value,
        upload,
        name: file.name,
        mimeType: file.type,
        size: file.size,
      },
    });

    const id = await sendToDrive(uploadUrl, file, (sent) => {
      uploadedShare.value = (sentBefore + sent) / totalBytes;
    });

    sentBefore += file.size;
    uploaded[upload].push(id);
  }

  return uploaded;
}
</script>

<template>
  <PageHeading text="Fighter Registration" />

  <section class="px-6 md:px-20 pb-24">
    <div class="max-w-3xl mx-auto">
      <div v-if="stage === 'registered'" class="grid gap-6" role="status">
        <h2 class="font-headline text-3xl font-black italic uppercase">Registration received</h2>
        <p class="text-on-surface/80 leading-relaxed">
          Thank you. TFC's matchmakers read every {{ DISCIPLINE_LABELS[discipline] }} registration
          and will reach you on the phone number or Instagram you gave if there is a fight for you.
        </p>
        <p class="text-on-surface/80 leading-relaxed">
          Registering doesn't guarantee you a spot in TFC.
          <span lang="ka">რეგისტრაციის შევსება არ არის გარანტია რომ TFC-ში იბრძოლებთ.</span>
        </p>
        <NuxtLink to="/" class="text-primary underline">Back to the home page</NuxtLink>
      </div>

      <template v-else>
        <p class="text-on-surface/80 leading-relaxed mb-4">
          Welcome to Tbilisi Fighting Championship. Join TFC and prove that you are the best.
        </p>
        <p class="text-on-surface/80 leading-relaxed mb-10">
          Registering doesn't guarantee you a spot in TFC.
          <span lang="ka">რეგისტრაციის შევსება არ არის გარანტია რომ TFC-ში იბრძოლებთ.</span>
        </p>

        <fieldset class="mb-12">
          <legend class="font-headline text-sm font-black uppercase tracking-widest mb-4">
            What do you fight in?
          </legend>
          <div class="grid grid-cols-3 border border-outline-variant/40">
            <label
              v-for="option in DISCIPLINES"
              :key="option"
              class="text-center px-2 py-4 font-headline font-black italic uppercase text-sm sm:text-lg cursor-pointer transition-colors has-focus-visible:outline-2 has-focus-visible:outline-primary"
              :class="
                discipline === option
                  ? 'bg-primary-container text-white'
                  : 'hover:text-primary hover:bg-surface-container-low'
              "
            >
              <input
                v-model="discipline"
                type="radio"
                name="discipline"
                :value="option"
                class="sr-only"
                :disabled="busy"
              />
              {{ DISCIPLINE_LABELS[option] }}
            </label>
          </div>
        </fieldset>

        <form class="grid gap-8" novalidate @submit.prevent="register">
          <template v-for="question in form.questions" :key="question.field">
            <RegistrationQuestion
              v-if="question.kind === 'choices'"
              v-model:ticked="fightingStyles"
              v-model:other="otherFightingStyle"
              :question="question"
              :problem="problems[question.field]"
            />
            <RegistrationQuestion
              v-else
              v-model="answers[question.field as Exclude<RegistrationField, 'fightingStyles'>]"
              :question="question"
              :problem="problems[question.field]"
            />
          </template>

          <RegistrationUpload
            v-for="upload in form.uploads"
            :key="upload.name"
            v-model="files[upload.name]"
            :upload="upload"
            :problem="problems[upload.name]"
          />

          <div aria-hidden="true" class="absolute -left-[9999px] w-px h-px overflow-hidden">
            <label for="website">Leave this empty</label>
            <input id="website" v-model="website" type="text" tabindex="-1" autocomplete="off" />
          </div>

          <p v-if="failure" class="text-sm text-error" role="alert">{{ failure }}</p>

          <p v-if="stage === 'uploading'" class="text-sm text-on-surface/80" role="status">
            Uploading your files: {{ Math.floor(uploadedShare * 100) }}%. Keep this page open.
          </p>

          <button
            type="submit"
            :disabled="busy"
            class="bg-primary-container text-white font-headline font-black uppercase tracking-widest px-8 py-4 disabled:opacity-60"
          >
            {{
              stage === "uploading"
                ? "Uploading…"
                : stage === "registering"
                  ? "Registering…"
                  : `Register for ${DISCIPLINE_LABELS[discipline]}`
            }}
          </button>
        </form>
      </template>
    </div>
  </section>
</template>
