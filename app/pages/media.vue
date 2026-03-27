<script setup lang="ts">
useHead({
  title: "Media | TFC — Tbilisi Fighting Championship",
});

interface VideoItem {
  id: string;
  title: string;
  subtitle?: string;
  image: string;
  duration?: string;
  badge?: string;
  large?: boolean;
  wide?: boolean;
}

const featuredVideos: VideoItem[] = [
  {
    id: "main",
    title: "UNDEFEATED: THE KOBA DOCUMENTARY",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDaknN3EL1WkcFXln1cc6S3rFFPqMKXDysP2b4dUwSdQ70_mVUQtFBpp_3UWOv-zWGw3LfIKwTxSBVJDp2EfR9FWznqT8T6Ph4hZkjLnlqK2Wdd9rCvuu7V0kONzyTeTeVEfxytOn2IMOT6O5dr-4OMws-NB-arUB3m9QyAbDsWwnRtgVohX9-AYG_nAtOi3M7f65p3pEfkMmWleVL-F4lBQW3UuMunsPap50h-3sk06zGR5refaD1UwchmHreNop6R9Pr-1wf1mGc",
    duration: "42:15 MIN",
    badge: "Exclusive",
    large: true,
  },
  {
    id: "weighins",
    title: "CHAMPIONSHIP WEIGH-INS",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDxRQ12ttV9E5TbwwhJcJKv8DRlrI5wq3mrF7mpvxUfGcGFwPB3tPpU6SCkQsFqrLtXR5cVjSXF4-DPxfn6fTpTdrr41M3FZlerFXbMke1DBgwXxwB19i_-_cixf13hXkMglcl7RWhoKPrhDc2me39gmP_7LOrppEgyk8oCFp02r8wZzp1t5KDFl11c8JKyv5uC5SoYMczGXn-rvIIzD38KDloOBJKJH5-PxFdFDvdLSdgrSsiX6d5Fw9--lxVdFK4GjBSj-jH5L2E",
    wide: true,
  },
  {
    id: "kos",
    title: "FASTEST KOs 2024",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuCKe-QGS-kHOuAn6DCF4l7hj0JkZW9MaV7DYW24_qxszdHIIOwdI6zN3ne9NFXVxzdU-1LtsC3nfJsO2gUa19k25apliVhFTVBnC8pMviE--XN-3EdWpmtpofKRZ6V3GgT2hTg6Pe8SuZ-JzEfqgKLgzsLY6qMD2GUDRc2fkkeq5swlwWtGd5g5i2REPGj9-ovhVjgCO-Bk9PXpPgtnTdQMlHxy6XVu9ElqbllVsB07riVlYjMha2gYdX3z50CiXpGor13OyzqETfE",
  },
  {
    id: "gear",
    title: "PRO GEAR REVIEW",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuAnuYixkUhpN5zSVftA8YVKckaTNEBGnAOvIPQKleEsl-kpfZHrpm-QR7xWDpmg5Dl4jy9ddHUe-UXjzI9ErEMDlmytFMEaM8cpzIScxzrOp5OTaw-pZUa40jBeAwD4XcJaqQh6OMYDXNfarQYj6saFBJ9ieRLg5CEiG2jt6L18TVd6z1_G9otVvVF59LMqJLmQ6vOLcSmXLyRFov08h4a_D7NkkzcIXMjBNwEZuLRk7ne2VnX18Xml2W5QMEma0k37TwEiYuNCybw",
  },
];

const photos = [
  {
    id: "1",
    alt: "Event Moment",
    src: "https://lh3.googleusercontent.com/aida-public/AB6AXuDdwLYYvud58bSjqECB6_0b3P3zKzrJJVl_1oZXKPuAApWyCVgWQxIcJ-DUY28_nyE35j9WwURu_qH3HAKNKrXgp0O24GqU5azIjLEU2y5rlnLwIEukSInTOZJ3XNmZjl6Zc_dUTxWYPW1iZBHS-sjfZi5scGnPLcEhgiykGkmI0GZYCZoudtg3ypeO-pGBSphI3tlXD2QJWmS4VjK-JdPwqKLW5dNRGfItrI5ti_swuy3ZgK5AS3CUCg9Ph0sQNReHc0vbSnjj_qI",
  },
  {
    id: "2",
    alt: "The Octagon Detail",
    src: "https://lh3.googleusercontent.com/aida-public/AB6AXuCCcU-JJre2fMjtA6KssoEL5SzNdC-IkfYvBwyA0WZqOLJA_PjTQaRm3fu3OgwS0Tbo7EtFv2b_BgIijbC6ECPTrR0ubYRc2LR9QDEASBXvk180sOIFG4NtycYgChpNwtuHNTd_9Jg2C2GrcVaf7Vz5NtIVCyKOoOKAy0d6GAfuoweub8N8lZ2Ke7U2xafybLuVU92SLxupg_qBJJXIC2oWrGN8A-jXdYYEIryVfjs-lQSAK9N5_o24qox0qJZcYCRXgJTCmMAUVho",
  },
  {
    id: "3",
    alt: "Backstage Prep",
    src: "https://lh3.googleusercontent.com/aida-public/AB6AXuDHON9R3aKODE-YXCwmPJmFNon_6oVQsGzuT5FuHnsb0_l0hp_cr0HUwUY2uBpaVQFdp7UQqH3_gjWsTCK46tztesSz1A1aodjkcS_rNXabJ79GzhFaooTVhRgH16T80bnDRmNHNFJdzpbK_3b6pfWcGcT_maT8xy2NAgMvoW-96LciG9U64IzySxR-kZx0kj7AvAXnKAyT6g8015lzmaHbQNyfB46i4aIojhfanj3oyyr6aVp0b4P1-WE__o6INST6LZzjCTiZvms",
  },
  {
    id: "4",
    alt: "Fighter Profile",
    src: "https://lh3.googleusercontent.com/aida-public/AB6AXuBsCOMaUafomvnOwqULz3GtEf9EnOSlbx6nzsTMl3BN9gOPas_OiDUgsUycVWgjUfgdemY9IblqoVWHnmo3LoDFFZnLy6qRodJDG9MKpdg51WKZ5M8joAFalHhnortZ7Q_0VSKkCaH6dv1m5-YM_0Cmn7UpBiFDoodXIH7dm9-8RD_f2vW8VbY3M7SHGPnVkFBciKSV4Sypd3twNvpM7LZW3Mc9vNw-Gyj9FZCaP4hHM2J_ScuNI2E2Wj2Y1nHjGcqVQ312nk4CcKo",
  },
  {
    id: "5",
    alt: "Grand Stage",
    src: "https://lh3.googleusercontent.com/aida-public/AB6AXuCAw3XmcbJINJj_YjXUXr_1scn2w-sSk8UD73ZlCUT7m822GuFjbWuiw8Xn1WvViUJ6i2O4RygCcHQAbFVVSf1gxspa2eb2EK3DFg6kbXiALLB0m6jKi-IqwTc8jSj_zWIpVGR6sLKivKjQZYeSXwxPhtSPs4Ll6vVYV8-FvtgvSXM-P68zcsmO-mBkjbNxRgP0mVsbKyRBTnp53LKqOtxONKx59xbSH8PCktfQjW2kAREdurjKZXoTavTqurhuXpw8HNkPHnDB3EI",
  },
  {
    id: "6",
    alt: "The Ritual",
    src: "https://lh3.googleusercontent.com/aida-public/AB6AXuBggqOzYZWnEINlErjkEIvsIliJe9HOXhIpQ-oR2mbveFB3-6u1omzQ7Ott9_dxNBRXFkg3D09U_jgiynae_6PgOtPhmGJ6ayASvQvRZ0O8dWrYsr3zDhuEVXDrPBimrD_EJNe6cKrCe-TAszTMnVGDzZzDjRNfL_gQpWUKDitxIX4eDyS3KOboEEwKYsYP2aPwG6MWwzhYCaJYulXhFFEaIdZLxWaMqHqXx_cPmdRZ1uXFcj7LArGq09yw-JxMHIB5sfkRdS18Wws",
  },
];

const pressQuotes = [
  {
    outlet: "MMA GLOBAL",
    quote: '"The new standard for European MMA production..."',
  },
  {
    outlet: "SPORTS HUB",
    quote: '"TFC 14 sets national PPV records in Georgia."',
  },
  {
    outlet: "CAUCASUS TIMES",
    quote: '"Fighter profiles that rival the UFC in depth."',
  },
];

const activeFilter = ref("ALL MEDIA");
const filters = ["ALL MEDIA", "HIGHLIGHTS", "INTERVIEWS"];
</script>

<template>
  <main class="">
    <section
      class="relative w-full h-[870px] overflow-hidden flex items-center justify-center bg-surface-container-lowest"
    >
      <div class="absolute inset-0 z-0">
        <img
          alt="MMA Action"
          class="w-full h-full object-cover opacity-60 grayscale hover:grayscale-0 transition-all duration-1000"
          src="https://lh3.googleusercontent.com/aida-public/AB6AXuBGCi-B-dvQfIu8gugkpvgpG5OJmSfmlSiCTu8f4RqCu0lbFRLQIIjXTK02tt4LTsvGCkj-4DazLvZ3l5XrqjD7YLeS7Ftj2mdBW5_PBI8QCwEgbRDFZa9y6L6YKK-baQc_fkKfm8b5GBoZlxG0xYpEafAKD3QYnKKKCO_OVDGI4ecE9rECdT4S0QlZsw3com_MTJOMFDaD2Cjh6ATLTjJx-rfv5p4n8gMMZhW0E-gRllczxNPACl9qxJv_qysp1OohQoqTo10eQcc"
        />
        <div
          class="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent"
        />
      </div>

      <div class="relative z-10 text-center px-4 max-w-5xl">
        <div class="mb-6 flex justify-center">
          <button
            class="group relative flex items-center justify-center w-24 h-24 bg-primary-container hover:bg-primary transition-colors duration-500 rounded-full"
          >
            <Icon
              name="material-symbols:play-arrow"
              class="text-white text-5xl translate-x-1"
              style="font-variation-settings: &quot;FILL&quot; 1"
            />
            <div
              class="absolute inset-0 rounded-full border-2 border-primary-container animate-ping opacity-20"
            />
          </button>
        </div>
        <h1
          class="font-headline font-black italic text-6xl md:text-8xl lg:text-9xl uppercase tracking-tighter leading-none text-white drop-shadow-2xl"
        >
          TOP 10 <br />
          <span class="text-primary">KNOCKOUTS</span>
        </h1>
        <p
          class="mt-6 font-headline italic uppercase tracking-[0.2em] text-secondary text-lg font-bold"
        >
          Official Highlight Reel — Season 4 Premiere
        </p>
      </div>

      <div
        class="absolute bottom-10 left-0 w-32 h-2 bg-secondary-fixed/20 skew-x-[-12deg] -translate-x-10"
      />
      <div
        class="absolute bottom-20 right-0 w-64 h-1 bg-primary-container/40 skew-x-[12deg] translate-x-20"
      />
    </section>

    <section class="py-24 px-8 bg-surface-container-low relative overflow-hidden">
      <div
        class="max-w-7xl mx-auto mb-16 flex flex-col md:flex-row md:items-end justify-between gap-6"
      >
        <div>
          <h2
            class="font-headline font-black italic text-5xl uppercase tracking-tighter leading-tight text-white mb-2"
          >
            BATTLE <span class="text-primary">ARCHIVES</span>
          </h2>
          <p class="text-on-surface-variant max-w-md font-medium">
            Re-live the intensity. From main card finishes to raw backstage interviews.
          </p>
        </div>
        <div class="flex gap-4 font-headline italic uppercase text-sm font-bold tracking-widest">
          <button
            v-for="filter in filters"
            :key="filter"
            class="pb-1 transition-colors"
            :class="
              activeFilter === filter
                ? 'text-primary border-b-2 border-primary'
                : 'text-on-surface-variant hover:text-white'
            "
            @click="activeFilter = filter"
          >
            {{ filter }}
          </button>
        </div>
      </div>

      <div class="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-4 auto-rows-[300px]">
        <div
          class="md:col-span-2 md:row-span-2 relative group overflow-hidden bg-surface-container-lowest"
        >
          <img
            :alt="featuredVideos[0].title"
            class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
            :src="featuredVideos[0].image"
          />
          <div class="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-all" />
          <div
            class="absolute bottom-0 left-0 p-8 w-full bg-gradient-to-t from-black to-transparent"
          >
            <span
              class="bg-primary text-white text-[10px] font-black italic px-3 py-1 uppercase tracking-widest mb-4 inline-block"
              >{{ featuredVideos[0].badge }}</span
            >
            <h3 class="font-headline font-black italic text-3xl uppercase text-white mb-2">
              {{ featuredVideos[0].title }}
            </h3>
            <p class="text-on-surface-variant text-sm flex items-center gap-2">
              <Icon name="material-symbols:schedule" class="text-sm" />
              {{ featuredVideos[0].duration }}
            </p>
          </div>
        </div>

        <div class="md:col-span-2 relative group overflow-hidden bg-surface-container-lowest">
          <img
            :alt="featuredVideos[1].title"
            class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
            :src="featuredVideos[1].image"
          />
          <div class="absolute inset-0 flex items-center justify-center">
            <Icon
              name="material-symbols:play-circle"
              class="text-white text-5xl opacity-0 group-hover:opacity-100 transition-opacity"
            />
          </div>
          <div class="absolute bottom-6 left-6">
            <h3 class="font-headline font-black italic text-xl uppercase text-white">
              {{ featuredVideos[1].title }}
            </h3>
          </div>
        </div>

        <div class="relative group overflow-hidden bg-surface-container-lowest">
          <img
            :alt="featuredVideos[2].title"
            class="w-full h-full object-cover opacity-80"
            :src="featuredVideos[2].image"
          />
          <div
            class="absolute inset-0 bg-primary-container/20 group-hover:opacity-0 transition-opacity"
          />
          <div class="absolute bottom-4 left-4">
            <h3 class="font-headline font-black italic text-sm uppercase text-white">
              {{ featuredVideos[2].title }}
            </h3>
          </div>
        </div>

        <div class="relative group overflow-hidden bg-surface-container-lowest">
          <img
            :alt="featuredVideos[3].title"
            class="w-full h-full object-cover"
            :src="featuredVideos[3].image"
          />
          <div class="absolute bottom-4 left-4">
            <h3 class="font-headline font-black italic text-sm uppercase text-white">
              {{ featuredVideos[3].title }}
            </h3>
          </div>
        </div>
      </div>
    </section>

    <section class="py-24 px-8 bg-surface relative overflow-hidden">
      <div
        class="absolute -top-20 -right-20 text-[20rem] font-black italic text-white/[0.02] font-headline select-none pointer-events-none"
      >
        TFC
      </div>

      <div class="max-w-7xl mx-auto flex flex-col items-center mb-16 text-center">
        <h2
          class="font-headline font-black italic text-6xl uppercase tracking-tighter text-white mb-4"
        >
          THE <span class="text-primary">LENS</span>
        </h2>
        <div class="w-20 h-1 bg-primary mb-8" />
      </div>

      <div class="max-w-[1400px] mx-auto grid grid-cols-2 md:grid-cols-3 gap-1">
        <div
          v-for="photo in photos"
          :key="photo.id"
          class="aspect-[4/5] overflow-hidden grayscale hover:grayscale-0 transition-all duration-500"
        >
          <img :alt="photo.alt" class="w-full h-full object-cover" :src="photo.src" />
        </div>
      </div>

      <div class="mt-12 text-center">
        <button
          class="font-headline font-black italic uppercase tracking-widest text-primary border-2 border-primary px-12 py-4 hover:bg-primary hover:text-white transition-all scale-95 hover:scale-100"
        >
          VIEW FULL PHOTO ARCHIVE
        </button>
      </div>
    </section>

    <section class="py-24 px-8 bg-surface-container-lowest">
      <div class="max-w-7xl mx-auto">
        <div
          class="flex flex-col md:flex-row items-center gap-12 border-y border-outline-variant/10 py-16"
        >
          <div class="w-full md:w-1/3">
            <h2
              class="font-headline font-black italic text-4xl uppercase text-white mb-4 leading-tight"
            >
              IN THE <br /><span class="text-secondary-fixed">HEADLINES</span>
            </h2>
            <p class="text-on-surface-variant text-sm font-medium">
              Global coverage of the Tbilisi Fighting Championship series from the world's leading
              sports outlets.
            </p>
          </div>

          <div class="w-full md:w-2/3 grid grid-cols-2 md:grid-cols-3 gap-12 items-center">
            <div
              v-for="item in pressQuotes"
              :key="item.outlet"
              class="flex flex-col gap-4 group cursor-pointer"
            >
              <h4
                class="font-headline font-black text-2xl text-secondary-fixed/40 group-hover:text-primary transition-colors italic uppercase"
              >
                {{ item.outlet }}
              </h4>
              <p class="text-xs uppercase tracking-tighter text-on-surface">{{ item.quote }}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  </main>
</template>

<style scoped>
.skew-x-negative {
  transform: skewX(-12deg);
}
.skew-x-positive {
  transform: skewX(12deg);
}
</style>
