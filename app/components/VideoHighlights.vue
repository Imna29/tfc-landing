<script setup lang="ts">
interface Highlight {
  id: string;
  title: string;
  subtitle: string;
  image: string;
  isMain: boolean;
}

const highlights: Highlight[] = [
  {
    id: "main",
    title: "Mamuka's Destructive Fly-Knee KO",
    subtitle: "TFC 24 Highlights",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuAKifUo-q1oofM2breudwptE-SFhtY27lbrXr5lqC142qt02sV2kHFdeI32WHsIRmAEwyyYmHDmut23135SOmnQftAl2Ux1gWV7wVQZ7W8A62hne7ihpW1bjI3onj4fJhLaeYuBBexTcSJ9eER0Ppbqv55Z8Gmbe47vZFg-LDbYpx8FTcDpJOulKOp06zYk_3dfw6K9qJPKIeho3qB9Yp2O_D5ikrlhBqjTEcn6OrFOHoARc59_feauj9UuH8rcICx_4CwBHIPOnfc",
    isMain: true,
  },
  {
    id: "submissions",
    title: "Top 5 Submissions",
    subtitle: "",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBd3_ZxfvQigXaixf9RA_CMZAbeWQoNhczURUQbroR_fK6HxrBgDJfE_Dnb9Y4X0rULjdKlqI17UZ5fb03M0_xrukqAaZ_iMIFhkKuPkSwCmqxt0zi9KnrZvhPLMLaO0E45ugqqNEMhaJP-bAHgE8BYKOF0mlC0xGB11-Sxe2FYhG3_mbhlTLVvv1TJpL9yXi9GAi4lFclOD9mo1bLgDZ6ThRkaehJgzFhEOUrJjhaSnVilnw-8jRyE_EhOxM37wdlFy1og-Dz0UI0",
    isMain: false,
  },
  {
    id: "road",
    title: "The Road to TFC 25",
    subtitle: "",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuAhJOTT8ok4T9PuRMXhmoUvY8j-2uSqxnWIj6xohEpIkAssKhIS0IHPpzPWTYlQbp9kzCK4s6FVcAdNDNS5aOZM0kbkaxTzQTB6BSAftP1DpSJ6eKASHEOXqbkcqafLNmux6BX1b_l7wkPs4cF9FIJnfw1soa2vjwyE000lEM9nNWr05MngxbHMTtCfuDHCZx6Qp7x5US7Kv-QNEO58DJmSWFYxl38ripGXgYRQyjDwG30miRuE63sF1TP2WcjMtTarKDIxDAaPNZs",
    isMain: false,
  },
];
</script>

<template>
  <section class="bg-surface-container-lowest py-24 border-y border-outline-variant/10">
    <div class="container mx-auto px-6 md:px-20">
      <div class="text-center max-w-2xl mx-auto mb-16">
        <h2 class="font-headline text-5xl font-black italic uppercase mb-4">Inside the Octagon</h2>
        <p class="text-on-surface-variant">
          Relive the most brutal knockouts and technical masterclasses from TFC history.
        </p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div
          class="md:col-span-3 aspect-video relative group overflow-hidden border border-outline-variant/20"
        >
          <img
            :alt="highlights[0].title"
            class="w-full h-full object-cover"
            :src="highlights[0].image"
          />
          <div
            class="absolute inset-0 bg-background/30 flex items-center justify-center group-hover:bg-background/10 transition-colors"
          >
            <button
              class="w-24 h-24 bg-primary-container text-white flex items-center justify-center skew-x-[-12deg] hover:scale-110 transition-transform"
            >
              <Icon
                name="material-symbols:play-arrow"
                class="skew-x-[12deg] text-5xl"
                style="font-variation-settings: &quot;FILL&quot; 1"
              />
            </button>
          </div>
          <div
            class="absolute bottom-0 left-0 p-8 bg-gradient-to-t from-background to-transparent w-full"
          >
            <p class="text-primary font-black uppercase text-sm mb-1 tracking-widest">
              {{ highlights[0].subtitle }}
            </p>
            <h3 class="font-headline text-3xl font-black italic uppercase">
              {{ highlights[0].title }}
            </h3>
          </div>
        </div>

        <div class="flex flex-col gap-6">
          <article
            v-for="highlight in highlights.slice(1)"
            :key="highlight.id"
            class="flex-1 bg-surface-container-low group cursor-pointer border border-outline-variant/5"
          >
            <div class="relative aspect-video">
              <img
                :alt="highlight.title"
                class="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity"
                :src="highlight.image"
              />
              <div class="absolute inset-0 flex items-center justify-center">
                <Icon name="material-symbols:play-circle" class="text-4xl text-white" />
              </div>
            </div>
            <div class="p-4">
              <p class="font-bold text-xs uppercase text-on-surface-variant">
                {{ highlight.title }}
              </p>
            </div>
          </article>
        </div>
      </div>
    </div>
  </section>
</template>
