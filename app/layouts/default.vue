<script setup lang="ts">
const { locale, locales, setLocale } = useI18n();
const isMobileMenuOpen = ref(false);

const mobileNavLinks = [
  { to: "/events", label: "Events" },
  { to: "/fighters", label: "Fighters" },
  { to: "/media", label: "Media" },
  { to: "/about", label: "About" },
];

const closeMobileMenu = () => {
  isMobileMenuOpen.value = false;
};
</script>

<template>
  <div
    class="bg-background text-on-surface font-body selection:bg-primary-container selection:text-white"
  >
    <header
      class="sticky top-0 z-50 bg-surface-container-high/70 backdrop-blur-xl border-b border-outline-variant/15 px-6 md:px-20 py-4"
    >
      <div class="max-w-[1440px] mx-auto">
        <div class="flex items-center justify-between">
          <NuxtLink to="/" class="flex items-center">
            <img
              src="/tfc_logo.png"
              alt="TFC Logo"
              width="96"
              height="48"
              loading="eager"
              decoding="async"
              fetchpriority="high"
              class="w-24 h-12 object-contain"
            />
          </NuxtLink>

          <nav class="hidden md:flex items-center gap-10">
            <NuxtLink
              to="/events"
              class="text-sm font-bold uppercase tracking-widest hover:text-primary transition-colors"
            >
              Events
            </NuxtLink>
            <NuxtLink
              to="/fighters"
              class="text-sm font-bold uppercase tracking-widest hover:text-primary transition-colors"
            >
              Fighters
            </NuxtLink>
            <NuxtLink
              to="/media"
              class="text-sm font-bold uppercase tracking-widest hover:text-primary transition-colors"
            >
              Media
            </NuxtLink>
            <NuxtLink
              to="/about"
              class="text-sm font-bold uppercase tracking-widest hover:text-primary transition-colors"
            >
              About
            </NuxtLink>
          </nav>

          <div class="flex items-center gap-6">
            <select
              :value="locale"
              @change="setLocale(($event?.target as HTMLSelectElement)?.value as 'en-us' | 'ka')"
              class="bg-transparent text-xl cursor-pointer border border-outline-variant/30 px-2 py-1 hover:border-primary transition-colors"
            >
              <option
                v-for="loc in locales"
                :key="loc.code"
                :value="loc.code"
                class="bg-surface-container-high text-sm"
              >
                {{ loc.code === "en-us" ? "🇺🇸" : "🇬🇪" }}
              </option>
            </select>
            <NuxtLink
              to="/contact"
              class="hidden md:inline-flex bg-primary-container text-white px-6 py-2 font-bold uppercase text-sm hover:scale-105 transition-transform active:scale-95"
            >
              Contact
            </NuxtLink>
            <button
              type="button"
              class="md:hidden w-11 h-11 border border-outline-variant/30 flex items-center justify-center hover:border-primary transition-colors"
              :aria-expanded="isMobileMenuOpen"
              aria-controls="mobile-nav"
              aria-label="Toggle navigation menu"
              @click="isMobileMenuOpen = !isMobileMenuOpen"
            >
              <Icon :name="isMobileMenuOpen ? 'material-symbols:close' : 'material-symbols:menu'" />
            </button>
          </div>
        </div>

        <nav
          v-if="isMobileMenuOpen"
          id="mobile-nav"
          class="md:hidden mt-4 border border-outline-variant/30 bg-surface-container-high"
        >
          <NuxtLink
            v-for="link in mobileNavLinks"
            :key="link.to"
            :to="link.to"
            class="block px-4 py-3 text-sm font-bold uppercase tracking-widest border-b border-outline-variant/15 last:border-b-0 hover:text-primary transition-colors"
            @click="closeMobileMenu"
          >
            {{ link.label }}
          </NuxtLink>
        </nav>
      </div>
    </header>

    <main>
      <slot />
    </main>

    <footer
      class="bg-surface-container-lowest pt-24 pb-12 px-6 md:px-20 border-t-4 border-primary-container"
    >
      <div class="container mx-auto">
        <div class="grid grid-cols-1 md:grid-cols-4 gap-16 mb-24">
          <div class="col-span-1 md:col-span-1">
            <div class="flex items-center text-white mb-8">
              <img
                src="/tfc_logo.png"
                alt="TFC Logo"
                width="96"
                height="48"
                loading="lazy"
                decoding="async"
                class="w-24 h-12 object-contain"
              />
            </div>
            <p class="text-on-surface-variant text-sm leading-relaxed mb-8">
              The heartbeat of combat sports in the Caucasus. Promoting elite mixed martial arts
              with honor, integrity, and raw power.
            </p>
            <div class="flex gap-4">
              <a
                class="w-10 h-10 border border-outline-variant/30 flex items-center justify-center hover:bg-primary-container transition-colors"
                href="#"
              >
                <Icon name="material-symbols:public" class="text-sm" />
              </a>
              <a
                class="w-10 h-10 border border-outline-variant/30 flex items-center justify-center hover:bg-primary-container transition-colors"
                href="#"
              >
                <Icon name="material-symbols:share" class="text-sm" />
              </a>
              <a
                class="w-10 h-10 border border-outline-variant/30 flex items-center justify-center hover:bg-primary-container transition-colors"
                href="#"
              >
                <Icon name="material-symbols:movie" class="text-sm" />
              </a>
            </div>
          </div>

          <div>
            <h4
              class="font-headline font-black italic uppercase text-lg mb-8 border-l-2 border-primary-container pl-4"
            >
              Navigation
            </h4>
            <ul
              class="space-y-4 text-sm font-bold uppercase tracking-widest text-on-surface-variant"
            >
              <li>
                <NuxtLink to="/events" class="hover:text-primary transition-colors"
                  >Events</NuxtLink
                >
              </li>
              <li>
                <NuxtLink to="/fighters" class="hover:text-primary transition-colors"
                  >Fighters</NuxtLink
                >
              </li>
              <li>
                <NuxtLink to="/media" class="hover:text-primary transition-colors">Media</NuxtLink>
              </li>
              <li>
                <NuxtLink to="/about" class="hover:text-primary transition-colors">About</NuxtLink>
              </li>
              <li>
                <NuxtLink to="/contact" class="hover:text-primary transition-colors"
                  >Contact</NuxtLink
                >
              </li>
            </ul>
          </div>

          <div>
            <h4
              class="font-headline font-black italic uppercase text-lg mb-8 border-l-2 border-primary-container pl-4"
            >
              Legal
            </h4>
            <ul
              class="space-y-4 text-sm font-bold uppercase tracking-widest text-on-surface-variant"
            >
              <li>
                <NuxtLink to="/privacy" class="hover:text-primary transition-colors"
                  >Privacy Policy</NuxtLink
                >
              </li>
              <li>
                <NuxtLink to="/terms" class="hover:text-primary transition-colors"
                  >Terms of Service</NuxtLink
                >
              </li>
            </ul>
          </div>

          <div>
            <h4
              class="font-headline font-black italic uppercase text-lg mb-8 border-l-2 border-primary-container pl-4"
            >
              Tbilisi Arena
            </h4>
            <p class="text-sm text-on-surface-variant mb-4">
              2 University St, Tbilisi 0177<br />
              Georgia
            </p>
            <p class="text-sm font-black text-primary mb-2">T: +995 32 2XX XXX</p>
            <p class="text-sm font-black text-primary">E: info@tfc.ge</p>
          </div>
        </div>

        <div
          class="flex flex-col md:flex-row justify-between items-center gap-8 pt-12 border-t border-outline-variant/10"
        >
          <p class="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
            © 2024 TBILISI FIGHTING CHAMPIONSHIP. ALL RIGHTS RESERVED.
          </p>
          <div class="flex gap-8">
            <span class="text-[10px] font-black uppercase italic tracking-widest"
              >Victory through Discipline</span
            >
            <span
              class="text-[10px] font-black uppercase italic tracking-widest text-primary-container"
              >Built for the Octagon</span
            >
          </div>
        </div>
      </div>
    </footer>
  </div>
</template>
