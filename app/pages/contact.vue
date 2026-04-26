<script setup lang="ts">
useHead({
  title: "Contact & Partnerships | TFC — Tbilisi Fighting Championship",
});

interface InquiryCard {
  id: string;
  icon: string;
  title: string;
  description: string;
  email: string;
  links?: { label: string; url: string }[];
}

const inquiryCards: InquiryCard[] = [
  {
    id: "sponsorships",
    icon: "handshake",
    title: "Sponsorships",
    description:
      "Partner with Georgia's fastest growing combat sports brand. Targeted exposure and premium activations.",
    email: "contact@tfcgeo.com",
  },
  {
    id: "fighter",
    icon: "fitness-center",
    title: "Fighter Application",
    description:
      "Ready to step into the cage? Send your record, highlights, and bio to our matchmaking team.",
    email: "",
    links: [
      {
        label: "SIGN UP (MMA)",
        url: "https://docs.google.com/forms/d/e/1FAIpQLSerFqgHNaMjnuWks-H08Uqc83nAYXtdpl8In6OV2AE4mIrfOQ/viewform?pli=1",
      },
      {
        label: "SIGN UP (CageBox)",
        url: "https://docs.google.com/forms/d/1qxObamc1uQWOx4e-roU6uZjC_h2Kezy2jmI-3GPPcV0/viewform?utm_source=ig&utm_medium=social&utm_content=link_in_bio",
      },
    ],
  },
  {
    id: "media",
    icon: "photo-camera",
    title: "Media & Press",
    description:
      "Apply for fight night credentials or request interview access with our world-class roster.",
    email: "contact@tfcgeo.com",
  },
];

const inquiryTypes = ["General Question", "Ticketing Issues", "Merchandise", "Other"];

const formData = reactive({
  fullName: "",
  email: "",
  inquiryType: "",
  message: "",
});

const isSubmitting = ref(false);
const submitStatus = ref<"idle" | "success" | "error">("idle");
const statusMessage = ref("");

const handleSubmit = async () => {
  isSubmitting.value = true;
  submitStatus.value = "idle";
  statusMessage.value = "";

  const formPayload = new FormData();
  formPayload.append("access_key", "3365ad90-abe9-4dc1-917b-a07c3f70ff5b");
  formPayload.append("name", formData.fullName);
  formPayload.append("email", formData.email);
  formPayload.append("inquiry_type", formData.inquiryType);
  formPayload.append("message", formData.message);

  try {
    const response = await fetch("https://api.web3forms.com/submit", {
      method: "POST",
      body: formPayload,
    });

    const data = await response.json();

    if (response.ok) {
      submitStatus.value = "success";
      statusMessage.value = "Success! Your message has been sent.";
      formData.fullName = "";
      formData.email = "";
      formData.inquiryType = "";
      formData.message = "";
    } else {
      submitStatus.value = "error";
      statusMessage.value = data.message || "Something went wrong. Please try again.";
    }
  } catch {
    submitStatus.value = "error";
    statusMessage.value = "Something went wrong. Please try again.";
  } finally {
    isSubmitting.value = false;
  }
};
</script>

<template>
  <main class="pt-20 pb-20 px-8 max-w-7xl mx-auto">
    <header class="mb-20">
      <div class="flex items-center space-x-4 mb-4">
        <div class="w-12 h-[2px] bg-primary" />
        <span class="text-primary font-headline font-bold tracking-widest uppercase text-sm"
          >Contact & Partnerships</span
        >
      </div>
      <h1
        class="text-6xl md:text-8xl font-headline font-black italic uppercase tracking-tighter leading-none mb-6"
      >
        ENTER THE <span class="text-primary">CAGE</span>
      </h1>
      <p class="max-w-2xl text-lg text-secondary leading-relaxed">
        Connect with the Tbilisi Fighting Championship team. Whether you're an elite fighter ready
        to prove your worth, a brand looking for global exposure, or media seeking press access—the
        conversation starts here.
      </p>
    </header>

    <div class="grid grid-cols-1 lg:grid-cols-12 gap-12">
      <section class="lg:col-span-7 bg-surface-container-low p-10 relative overflow-hidden">
        <div class="absolute top-0 right-0 w-32 h-32 bg-primary/5 -mr-16 -mt-16 rotate-45" />
        <h2
          class="text-3xl font-headline font-black italic uppercase mb-8 border-l-4 border-primary pl-6"
        >
          General Inquiries
        </h2>

        <form class="space-y-8" @submit.prevent="handleSubmit">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div class="relative">
              <label class="block text-xs font-bold uppercase tracking-widest text-primary mb-2"
                >Full Name</label
              >
              <input
                v-model="formData.fullName"
                type="text"
                name="name"
                required
                placeholder="John Doe"
                class="w-full bg-transparent border-0 border-b-2 border-outline-variant/30 focus:border-primary focus:ring-0 text-on-surface py-3 transition-colors placeholder:text-surface-variant"
              />
            </div>
            <div class="relative">
              <label class="block text-xs font-bold uppercase tracking-widest text-primary mb-2"
                >Email Address</label
              >
              <input
                v-model="formData.email"
                type="email"
                name="email"
                required
                placeholder="example@gmail.com"
                class="w-full bg-transparent border-0 border-b-2 border-outline-variant/30 focus:border-primary focus:ring-0 text-on-surface py-3 transition-colors placeholder:text-surface-variant"
              />
            </div>
          </div>

          <div class="relative">
            <label class="block text-xs font-bold uppercase tracking-widest text-primary mb-2"
              >Inquiry Type</label
            >
            <select
              v-model="formData.inquiryType"
              name="inquiry_type"
              required
              class="w-full bg-transparent border-0 border-b-2 border-outline-variant/30 focus:border-primary focus:ring-0 text-on-surface py-3 transition-colors appearance-none"
            >
              <option v-for="type in inquiryTypes" :key="type" class="bg-surface-container-highest">
                {{ type }}
              </option>
            </select>
          </div>

          <div class="relative">
            <label class="block text-xs font-bold uppercase tracking-widest text-primary mb-2"
              >Your Message</label
            >
            <textarea
              v-model="formData.message"
              name="message"
              rows="5"
              required
              placeholder="STATE YOUR PURPOSE..."
              class="w-full bg-transparent border-0 border-b-2 border-outline-variant/30 focus:border-primary focus:ring-0 text-on-surface py-3 transition-colors resize-none placeholder:text-surface-variant"
            />
          </div>

          <button
            type="submit"
            :disabled="isSubmitting"
            class="w-full py-5 bg-primary-container text-white font-headline font-black italic uppercase tracking-tighter text-xl hover:bg-on-primary-fixed-variant transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {{ isSubmitting ? "SENDING..." : "SEND MESSAGE" }}
          </button>

          <p
            v-if="submitStatus !== 'idle'"
            class="text-center font-bold uppercase tracking-widest text-sm"
            :class="submitStatus === 'success' ? 'text-green-500' : 'text-red-500'"
          >
            {{ statusMessage }}
          </p>
        </form>
      </section>

      <div class="lg:col-span-5 space-y-8">
        <div class="grid grid-cols-1 gap-6">
          <div
            v-for="card in inquiryCards"
            :key="card.id"
            class="bg-surface-container-highest p-8 group hover:bg-primary transition-all duration-500 cursor-pointer border-l-4 border-transparent hover:border-white"
          >
            <div class="flex justify-between items-start mb-6">
              <Icon
                :name="`material-symbols:${card.icon}`"
                class="text-4xl text-primary group-hover:text-white"
              />
              <Icon
                name="material-symbols:arrow-outward"
                class="text-2xl opacity-30 group-hover:opacity-100"
              />
            </div>
            <h3
              class="text-2xl font-headline font-black italic uppercase group-hover:text-white mb-2"
            >
              {{ card.title }}
            </h3>
            <p class="text-secondary group-hover:text-white/80 text-sm">{{ card.description }}</p>
            <div class="mt-4 pt-4 border-t border-outline-variant/10 group-hover:border-white/20">
              <span
                v-if="card.email"
                class="text-primary font-bold group-hover:text-white uppercase text-xs tracking-widest"
                >{{ card.email }}</span
              >
              <div v-if="card.links" class="mt-3 flex flex-col gap-2">
                <a
                  v-for="link in card.links"
                  :key="link.label"
                  :href="link.url"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-primary font-bold group-hover:text-white uppercase text-xs tracking-widest hover:underline"
                >
                  {{ link.label }}
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </main>
</template>
