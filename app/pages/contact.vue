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
}

const inquiryCards: InquiryCard[] = [
  {
    id: "sponsorships",
    icon: "handshake",
    title: "Sponsorships",
    description:
      "Partner with Georgia's fastest growing combat sports brand. Targeted exposure and premium activations.",
    email: "partners@tfc.ge",
  },
  {
    id: "fighter",
    icon: "fitness-center",
    title: "Fighter Application",
    description:
      "Ready to step into the cage? Send your record, highlights, and bio to our matchmaking team.",
    email: "matchmaking@tfc.ge",
  },
  {
    id: "media",
    icon: "photo-camera",
    title: "Media & Press",
    description:
      "Apply for fight night credentials or request interview access with our world-class roster.",
    email: "press@tfc.ge",
  },
];

const inquiryTypes = ["General Question", "Ticketing Issues", "Merchandise", "Other"];

const formData = reactive({
  fullName: "",
  email: "",
  inquiryType: "",
  message: "",
});

const handleSubmit = () => {
  console.log("Form submitted:", formData);
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
        ENTER THE <span class="text-primary">ARENA</span>
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
                placeholder="GIO GIORGI"
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
                placeholder="FIGHTER@TFC.GE"
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
              rows="5"
              placeholder="STATE YOUR PURPOSE..."
              class="w-full bg-transparent border-0 border-b-2 border-outline-variant/30 focus:border-primary focus:ring-0 text-on-surface py-3 transition-colors resize-none placeholder:text-surface-variant"
            />
          </div>

          <button
            type="submit"
            class="w-full py-5 bg-primary-container text-white font-headline font-black italic uppercase tracking-tighter text-xl hover:bg-on-primary-fixed-variant transition-all duration-300"
          >
            SEND MESSAGE
          </button>
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
                class="text-primary font-bold group-hover:text-white uppercase text-xs tracking-widest"
                >{{ card.email }}</span
              >
            </div>
          </div>
        </div>
      </div>
    </div>

    <section class="mt-24">
      <div
        class="grid grid-cols-1 lg:grid-cols-2 gap-0 overflow-hidden bg-surface-container-lowest"
      >
        <div class="p-12 md:p-20 flex flex-col justify-center border-l-8 border-primary">
          <h2
            class="text-4xl md:text-5xl font-headline font-black italic uppercase mb-8 leading-tight"
          >
            THE TFC <br /><span class="text-primary">HEADQUARTERS</span>
          </h2>
          <div class="space-y-6">
            <div class="flex items-start space-x-4">
              <Icon name="material-symbols:location-on" class="text-primary" />
              <div>
                <h4 class="font-headline font-bold uppercase tracking-wider text-white">Address</h4>
                <p class="text-secondary italic">
                  8 Shota Rustaveli Avenue, <br />Tbilisi 0108, Georgia
                </p>
              </div>
            </div>
            <div class="flex items-start space-x-4">
              <Icon name="material-symbols:schedule" class="text-primary" />
              <div>
                <h4 class="font-headline font-bold uppercase tracking-wider text-white">
                  Office Hours
                </h4>
                <p class="text-secondary italic">Monday — Friday<br />10:00 AM — 19:00 PM GET</p>
              </div>
            </div>
          </div>
        </div>
        <div class="relative h-[400px] lg:h-auto bg-surface-container-low group">
          <img
            alt="Tbilisi Cityscape Map Background"
            loading="lazy"
            decoding="async"
            fetchpriority="low"
            class="w-full h-full object-cover opacity-50 grayscale contrast-125 group-hover:scale-105 transition-transform duration-1000"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuCqJ7DE0m_ZzJDmJ3Ny21kIKqB6IW5w82yNm1KjNW3UgbYqo5u7QS3wbZQH23_2TwPaQd0QvxoNv9ftKtq4Ng0mHviLz0nW1DEsPlgBVoxsxcMgj8YA_EpPuGJuqPoGTtwzTdhroGHT7IhkwQ5Jr6FquM_cQyvfHZi8zV-M3HPDNKu5Ic0KYT6cpcEIzRrggdFQuhkNLlhz4XYgSLDJIzhmEjGqnPrALzDknQyAhjaP2U_YkxzVWpYqxSYzmPoDoQDNLeVaGzBOyxk"
          />
          <div class="absolute inset-0 flex items-center justify-center">
            <div class="relative">
              <div class="absolute -inset-4 bg-primary/20 animate-ping rounded-full" />
              <div
                class="w-6 h-6 bg-primary border-4 border-white shadow-[0_0_20px_#D32F2F] rotate-45"
              />
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="mt-24 grid grid-cols-1 md:grid-cols-3 gap-8">
      <div
        class="bg-surface-container-low p-8 text-center border-b-4 border-transparent hover:border-primary transition-all duration-300"
      >
        <h4 class="font-headline font-black italic uppercase text-lg mb-4">Newsletter</h4>
        <p class="text-secondary text-sm mb-6">
          Get early access to tickets and exclusive fighter interviews.
        </p>
        <button
          class="w-full py-3 bg-white text-black font-headline font-bold uppercase hover:bg-primary hover:text-white transition-colors"
        >
          SUBSCRIBE
        </button>
      </div>

      <div
        class="bg-surface-container-low p-8 text-center border-b-4 border-transparent hover:border-primary transition-all duration-300"
      >
        <h4 class="font-headline font-black italic uppercase text-lg mb-4">Social Hub</h4>
        <p class="text-secondary text-sm mb-6">
          Join 500k+ fans watching the action live on our social channels.
        </p>
        <div class="flex justify-center space-x-4">
          <Icon
            name="material-symbols:play-circle"
            class="cursor-pointer hover:text-primary transition-colors text-2xl"
          />
          <Icon
            name="material-symbols:photo-camera"
            class="cursor-pointer hover:text-primary transition-colors text-2xl"
          />
          <Icon
            name="material-symbols:forum"
            class="cursor-pointer hover:text-primary transition-colors text-2xl"
          />
        </div>
      </div>

      <div
        class="bg-surface-container-low p-8 text-center border-b-4 border-transparent hover:border-primary transition-all duration-300"
      >
        <h4 class="font-headline font-black italic uppercase text-lg mb-4">Ambassadors</h4>
        <p class="text-secondary text-sm mb-6">
          Apply to represent TFC in your city and earn exclusive perks.
        </p>
        <button
          class="w-full py-3 border border-outline-variant text-white font-headline font-bold uppercase hover:bg-white hover:text-black transition-all"
        >
          JOIN THE CREW
        </button>
      </div>
    </section>
  </main>
</template>
