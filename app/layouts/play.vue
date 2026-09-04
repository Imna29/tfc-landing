<script setup lang="ts">
import { PLAY_FINE_PRINT, PLAY_NAV, PLAY_TFC } from "~/utils/navigation";

/**
 * PlayTFC: the game's own chrome, on every page the game is played on.
 *
 * A fan inside the section is doing one thing — reading a card, weighing up an
 * answer, watching a Balance — and this header is built around that: the card,
 * the board it is climbed on, what it is played for, and the Coins in hand.
 * The marketing site's seven sections are not here, and the way back to them
 * is the TFC mark on the left, which is where a reader already looks for it.
 *
 * Which pages get this is not decided here and not decided page by page. It is
 * `PLAY_SECTION` in `app/utils/navigation.ts`, applied by
 * `app/middleware/play-section.global.ts`, so the two navigations cannot come
 * to disagree about which site a page belongs to.
 *
 * **Nothing here is rendered from a session.** Two pages in the section are
 * edge-cached — `/prizes` and `/contest-rules` are the same page for every
 * reader — so this header ships the same HTML to everybody and the Balance is
 * filled in afterwards by the browser (ADR-0008, and `FanBalance`).
 */
const isMenuOpen = ref(false);

const closeMenu = () => {
  isMenuOpen.value = false;
};
</script>

<template>
  <div
    class="min-h-screen flex flex-col bg-background text-on-surface font-body selection:bg-primary-container selection:text-white"
  >
    <header
      class="sticky top-0 z-50 bg-surface-container-lowest/90 backdrop-blur-xl border-b border-outline-variant/15"
    >
      <div class="max-w-[1440px] mx-auto px-6 md:px-20 py-4">
        <div class="flex items-center gap-6">
          <NuxtLink to="/" class="flex items-center shrink-0" aria-label="TFC, the main site">
            <img
              src="/tfc_logo.png"
              alt="TFC Logo"
              width="96"
              height="48"
              loading="eager"
              decoding="async"
              fetchpriority="high"
              class="w-20 h-10 md:w-24 md:h-12 object-contain"
            />
          </NuxtLink>

          <NuxtLink
            :to="PLAY_TFC.to"
            class="flex items-center gap-2 shrink-0 border-l border-outline-variant/20 pl-4 md:pl-6"
          >
            <TfcCoin class="w-6 h-6 shrink-0" />
            <span
              class="hidden sm:inline font-headline text-lg md:text-xl font-black italic uppercase tracking-tight"
            >
              {{ PLAY_TFC.label }}
            </span>
            <span class="sr-only sm:hidden">{{ PLAY_TFC.label }}</span>
          </NuxtLink>

          <nav class="hidden lg:flex items-center gap-8 ml-4">
            <NuxtLink
              v-for="link in PLAY_NAV"
              :key="link.to"
              :to="link.to"
              class="text-sm font-bold uppercase tracking-widest text-on-surface/70 hover:text-primary transition-colors aria-[current=page]:text-primary"
            >
              {{ link.label }}
            </NuxtLink>
          </nav>

          <div class="ml-auto flex items-center gap-4 md:gap-6">
            <FanBalance />

            <NuxtLink
              to="/profile"
              class="hidden md:inline-flex text-sm font-bold uppercase tracking-widest text-on-surface/70 hover:text-primary transition-colors"
            >
              Account
            </NuxtLink>

            <button
              type="button"
              class="lg:hidden w-11 h-11 border border-outline-variant/30 flex items-center justify-center hover:border-primary transition-colors"
              :aria-expanded="isMenuOpen"
              aria-controls="play-nav"
              aria-label="Toggle navigation menu"
              @click="isMenuOpen = !isMenuOpen"
            >
              <Icon :name="isMenuOpen ? 'material-symbols:close' : 'material-symbols:menu'" />
            </button>
          </div>
        </div>

        <nav
          v-if="isMenuOpen"
          id="play-nav"
          class="lg:hidden mt-4 border border-outline-variant/30 bg-surface-container-high"
        >
          <NuxtLink
            v-for="link in PLAY_NAV"
            :key="link.to"
            :to="link.to"
            class="block px-4 py-3 text-sm font-bold uppercase tracking-widest border-b border-outline-variant/15 hover:text-primary transition-colors aria-[current=page]:text-primary"
            @click="closeMenu"
          >
            {{ link.label }}
          </NuxtLink>
          <NuxtLink
            to="/profile"
            class="block px-4 py-3 text-sm font-bold uppercase tracking-widest hover:text-primary transition-colors"
            @click="closeMenu"
          >
            Account
          </NuxtLink>
        </nav>
      </div>
    </header>

    <main class="flex-1">
      <slot />
    </main>

    <footer class="border-t border-outline-variant/15 bg-surface-container-lowest">
      <div
        class="max-w-[1440px] mx-auto px-6 md:px-20 py-10 flex flex-col gap-6 md:flex-row md:items-center md:justify-between"
      >
        <p class="max-w-xl text-xs text-on-surface/60 leading-relaxed">
          {{ PLAY_FINE_PRINT }}
        </p>

        <ul
          class="flex flex-wrap gap-x-6 gap-y-2 text-xs font-bold uppercase tracking-widest text-on-surface/60"
        >
          <li>
            <NuxtLink to="/contest-rules" class="hover:text-primary transition-colors">
              Contest Rules
            </NuxtLink>
          </li>
          <li>
            <NuxtLink to="/privacy-policy" class="hover:text-primary transition-colors">
              Privacy
            </NuxtLink>
          </li>
          <li>
            <NuxtLink to="/terms-of-service" class="hover:text-primary transition-colors">
              Terms
            </NuxtLink>
          </li>
          <li>
            <NuxtLink to="/contact" class="hover:text-primary transition-colors">Contact</NuxtLink>
          </li>
          <li>
            <NuxtLink to="/" class="hover:text-primary transition-colors">TFC main site</NuxtLink>
          </li>
        </ul>
      </div>
    </footer>
  </div>
</template>
