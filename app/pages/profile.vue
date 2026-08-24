<script setup lang="ts">
/**
 * What a fan sees of their own account.
 *
 * Balance, Entry history and leaderboard rank belong here and arrive with #17.
 * Today it is the identity page: it is what proves a session survives a reload
 * and reaches a server-rendered route, and it is where a signed-out visitor is
 * asked to sign in.
 */
const { data: fan, refresh } = await useFan();

useSeoMeta({
  title: "Your account",
  description: "Your TFC Predictions account.",
  robots: "noindex",
});

const signingOut = ref(false);

async function signOut() {
  signingOut.value = true;

  try {
    await $fetch("/api/auth/sign-out", { method: "POST" });
    await refresh();
    await navigateTo("/account/sign-in");
  } finally {
    signingOut.value = false;
  }
}
</script>

<template>
  <PageHeading text="Your account" />

  <section class="px-6 md:px-20 pb-24">
    <div class="max-w-xl mx-auto">
      <template v-if="fan">
        <dl class="grid gap-px bg-outline-variant/20 border border-outline-variant/20">
          <div class="bg-surface-container-low p-8">
            <dt
              class="font-headline text-sm font-black uppercase tracking-widest text-on-surface/60"
            >
              Username
            </dt>
            <dd class="font-headline text-3xl font-black italic uppercase mt-2">
              {{ fan.username }}
            </dd>
          </div>

          <div class="bg-surface-container-low p-8">
            <dt
              class="font-headline text-sm font-black uppercase tracking-widest text-on-surface/60"
            >
              Email address
            </dt>
            <dd class="mt-2">{{ fan.email }}</dd>
            <dd class="mt-2 text-sm text-on-surface/70">
              {{
                fan.emailVerified
                  ? "Confirmed."
                  : "Not confirmed yet. Confirm it before you submit your first Entry."
              }}
            </dd>
          </div>
        </dl>

        <button
          type="button"
          :disabled="signingOut"
          class="mt-10 border border-outline-variant/40 font-headline font-black uppercase tracking-widest px-8 py-4 disabled:opacity-60"
          @click="signOut"
        >
          {{ signingOut ? "Signing you out…" : "Sign out" }}
        </button>
      </template>

      <template v-else>
        <p class="text-on-surface/80 leading-relaxed">Sign in to see your account.</p>

        <div class="mt-8 flex flex-wrap gap-4">
          <NuxtLink
            to="/account/sign-in"
            class="bg-primary-container text-white font-headline font-black uppercase tracking-widest px-8 py-4"
          >
            Sign in
          </NuxtLink>
          <NuxtLink
            to="/account/sign-up"
            class="border border-outline-variant/40 font-headline font-black uppercase tracking-widest px-8 py-4"
          >
            Create an account
          </NuxtLink>
        </div>
      </template>
    </div>
  </section>
</template>
