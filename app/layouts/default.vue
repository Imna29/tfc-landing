<script setup lang="ts">
import { isFilled } from "@prismicio/client";
import { PrismicLink } from "@prismicio/vue";

import { MARKETING_NAV } from "~/utils/navigation";

/**
 * The marketing site: what TFC is, for anybody who has arrived to read about
 * it.
 *
 * The game is not in this header. It is reached through `PlayTfcButton` and
 * nowhere else, and everything the game needs beside it — the card, the
 * board, the Balance, the account — lives in the game's own chrome
 * (`app/layouts/play.vue`). `app/utils/navigation.ts` is where that line is
 * drawn and why.
 */
const { client } = usePrismic();
const isMobileMenuOpen = ref(false);

// One list, both navigations. A section added there appears in each of them,
// rather than in whichever one whoever added it remembered.
const navLinks = MARKETING_NAV;

const closeMobileMenu = () => {
  isMobileMenuOpen.value = false;
};

const { data: footerDocument } = await useAsyncData("en-us/footer", () =>
  client.getSingle("footer", { lang: "en-us" }),
);

const footer = computed(() => {
  const data = footerDocument.value?.data;
  if (!data) {
    return null;
  }

  return {
    logo: isFilled.image(data.logo) ? data.logo : null,
    aboutText: data.about_text || "",
    socialLinks: (data.social_links ?? []).filter((item) => isFilled.link(item.link)),
    navigationHeading: data.navigation_heading || "",
    navigationLinks: (data.navigation_links ?? []).filter((item) => isFilled.link(item.link)),
    legalHeading: data.legal_heading || "",
    legalLinks: (data.legal_links ?? []).filter((item) => isFilled.link(item.link)),
    contact: data.contact || "",
    contactLinks: (data.contact_links ?? []).filter((item) => isFilled.link(item.link)),
    email: data.email || "",
  };
});
</script>

<template>
  <div
    class="bg-background text-on-surface font-body selection:bg-primary-container selection:text-white"
  >
    <header
      class="sticky top-0 z-50 bg-surface-container-high/70 backdrop-blur-xl border-b border-outline-variant/15 px-4 md:px-20 py-4"
    >
      <div class="max-w-[1440px] mx-auto">
        <div class="flex items-center justify-between gap-4 md:gap-6">
          <!--
            The logo and the way into the game, kept together and in that
            order. The coin hangs 18px outside the button's own box, so the
            gap here is what stands between the two marks — see
            `PlayTfcButton`, which pays for the overhang itself.
          -->
          <div class="flex min-w-0 items-center gap-4 md:gap-6">
            <NuxtLink to="/" class="flex shrink-0 items-center">
              <img
                src="/tfc_logo.png"
                alt="TFC Logo"
                width="96"
                height="48"
                loading="eager"
                decoding="async"
                fetchpriority="high"
                class="w-16 h-8 sm:w-20 sm:h-10 md:w-24 md:h-12 object-contain"
              />
            </NuxtLink>

            <!--
              The one thing in this header that knows who is asking, and the
              only way it can be: the Balance inside it is fetched by the
              browser and is not in the HTML the server sends, so what this
              header ships is the same for everybody and stays safe to
              edge-cache (ADR-0008). Every other link here is the same link
              for everyone.
            -->
            <PlayTfcButton />
          </div>

          <nav class="hidden md:flex items-center gap-8 lg:gap-10">
            <NuxtLink
              v-for="link in navLinks"
              :key="link.to"
              :to="link.to"
              class="text-sm font-bold uppercase tracking-widest hover:text-primary transition-colors"
            >
              {{ link.label }}
            </NuxtLink>
          </nav>

          <div class="flex items-center gap-4 md:gap-6 shrink-0">
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
            v-for="link in navLinks"
            :key="link.to"
            :to="link.to"
            class="block px-4 py-3 text-sm font-bold uppercase tracking-widest border-b border-outline-variant/15 last:border-b-0 hover:text-primary transition-colors"
            @click="closeMobileMenu"
          >
            {{ link.label }}
          </NuxtLink>
          <NuxtLink
            to="/contact"
            class="block bg-primary-container text-white px-6 py-2 font-bold uppercase text-sm hover:scale-105 transition-transform active:scale-95 text-center"
            @click="closeMobileMenu"
          >
            Contact
          </NuxtLink>
        </nav>
      </div>
    </header>

    <main>
      <slot />
    </main>

    <footer
      v-if="footer"
      class="bg-surface-container-lowest pt-24 pb-12 px-6 md:px-20 border-t-4 border-primary-container"
    >
      <div class="container mx-auto">
        <div class="grid grid-cols-1 md:grid-cols-4 gap-16 mb-24">
          <div class="col-span-1 md:col-span-1">
            <div class="flex items-center text-white mb-8">
              <img
                v-if="footer.logo?.url"
                :alt="footer.logo.alt || 'TFC Logo'"
                :src="footer.logo.url"
                width="96"
                height="48"
                loading="lazy"
                decoding="async"
                class="w-24 h-12 object-contain"
              />
              <img
                v-else
                src="/tfc_logo.png"
                alt="TFC Logo"
                width="96"
                height="48"
                loading="lazy"
                decoding="async"
                class="w-24 h-12 object-contain"
              />
            </div>
            <p v-if="footer.aboutText" class="text-on-surface-variant text-sm leading-relaxed mb-8">
              {{ footer.aboutText }}
            </p>
            <div v-if="footer.socialLinks.length > 0" class="flex gap-4">
              <PrismicLink
                v-for="(social, index) in footer.socialLinks"
                :key="index"
                :field="social.link"
                class="w-10 h-10 border border-outline-variant/30 flex items-center justify-center hover:bg-primary-container transition-colors"
              >
                <Icon v-if="social.icon" :name="social.icon" class="text-sm text-white" />
              </PrismicLink>
            </div>
          </div>

          <div v-if="footer.navigationLinks.length > 0">
            <h4
              v-if="footer.navigationHeading"
              class="font-headline font-black italic uppercase text-lg mb-8 border-l-2 border-primary-container pl-4"
            >
              {{ footer.navigationHeading }}
            </h4>
            <ul
              class="space-y-4 text-sm font-bold uppercase tracking-widest text-on-surface-variant"
            >
              <li v-for="(navLink, index) in footer.navigationLinks" :key="index">
                <PrismicLink :field="navLink.link" class="hover:text-primary transition-colors">
                  {{ navLink.link.text }}
                </PrismicLink>
              </li>
            </ul>
          </div>

          <div>
            <h4
              class="font-headline font-black italic uppercase text-lg mb-8 border-l-2 border-primary-container pl-4"
            >
              {{ footer.legalHeading || "Legal" }}
            </h4>
            <ul
              class="space-y-4 text-sm font-bold uppercase tracking-widest text-on-surface-variant"
            >
              <li v-for="(legalLink, index) in footer.legalLinks" :key="index">
                <PrismicLink :field="legalLink.link" class="hover:text-primary transition-colors" />
              </li>
              <li>
                <NuxtLink to="/contest-rules" class="hover:text-primary transition-colors">
                  Contest Rules
                </NuxtLink>
              </li>
            </ul>
          </div>

          <div v-if="footer.contact || footer.email">
            <h4
              v-if="footer.contact"
              class="font-headline font-black italic uppercase text-lg mb-8 border-l-2 border-primary-container pl-4"
            >
              {{ footer.contact }}
            </h4>
            <ul
              v-if="footer.contactLinks.length > 0"
              class="space-y-4 text-sm font-bold uppercase tracking-widest text-on-surface-variant mb-4"
            >
              <li v-for="(contactLink, index) in footer.contactLinks" :key="index">
                <PrismicLink
                  :field="contactLink.link"
                  class="hover:text-primary transition-colors"
                />
              </li>
            </ul>
            <p v-if="footer.email" class="text-sm font-black text-primary">E: {{ footer.email }}</p>
          </div>
        </div>

        <div
          class="flex flex-col md:flex-row justify-between items-center gap-8 pt-12 border-t border-outline-variant/10"
        >
          <p class="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
            © {{ new Date().getFullYear() }} TBILISI FIGHTING CHAMPIONSHIP. ALL RIGHTS RESERVED.
          </p>
          <div class="flex gap-1">
            <span class="text-[12px] font-black uppercase italic tracking-widest">POWERED BY</span>
            <a
              href="https://imna.digital"
              target="_blank"
              class="text-[12px] font-black uppercase italic tracking-widest text-primary-container"
              >IMNA DIGITAL</a
            >
          </div>
        </div>
      </div>
    </footer>
  </div>
</template>
