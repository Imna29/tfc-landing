<script setup lang="ts">
interface NewsArticle {
  id: string
  date: string
  title: string
  excerpt: string
  image: string
}

const articles: NewsArticle[] = [
  {
    id: '1',
    date: 'October 12, 2024',
    title: "Levan 'Iron Grip' Training Camp Secret Revealed",
    excerpt: 'Go inside the mountain retreat where Levan is preparing for the toughest fight of his career against Silva.',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBW0kNAV07ALaq1CKW4tybr-VoPWpZJW-8Tqb9qE9T-QmBnAt-tE6kOclANmGarM7CVHIhVag_i7f1cIb92OATGW-_g31VmXEA1NmJX99onbSyrC5tpanVH9-4qa_mFlAk_Wju6JfNLZ8vfZmCabSIpeHkloGjjj-kj8ajlErIVt3ikdtwQOx6bYzlnSvKFzmJWZRfD4dyARJZhuI09kpKsq9uY_QfGYZRd0oQMkMqE7CGAGWckbj9eyd2zEsUxRZFkcufT6bJ5VzM',
  },
  {
    id: '2',
    date: 'October 10, 2024',
    title: 'Official Rankings Update: Shakeup in Featherweight Division',
    excerpt: 'After TFC 24, the standings have shifted significantly. See who moved up and who is on the bubble.',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDQEH2cLxtzOroJl2_YjPrS7MZaICuSY1c8aC96sHUcDz8-PwvneRH6uG_w6X9x1TKBuQ4hq6RDfFT-RetQGJ-lQXaWispEZCGxWfLjqbHBgaYmGjwky_8Mont4CnaHQcvk8IRcLEtw2tW5Ov7HRVlGNgmo2JH8Sh7GzQk9ZoF5mDy3oBFlOErvocsbg5HQPbUl04ig846IFEUbpHOH2ClfJfq58S786aS1hjwsNqPKRAdm13ECWneuqFyRLdPUgy7iAZxVbe7C78I',
  },
  {
    id: '3',
    date: 'October 08, 2024',
    title: 'New Talent Search: TFC Open Trials in Tbilisi Next Month',
    excerpt: 'The search for the next generation of Georgian warriors begins. Registration now open for all weight classes.',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBo62b7Hz_y8F3j9ZAXf32aRMQ-atQNvomB6YBwlyHr_sk8ZWQ3Juzz_6vFNUvEnrjZolXq6nB2tXNafkTDdzaAc8vF87ZRs4GVJNFmAqUXZ2OL2ixcAkozFzfBBW-pQdEXa4L5Evfjt9pO45JMgGYYPBsDWQPllJu39ElUjUIjcj1X_5IG0lsyfeGFSVK7RqWb3KPJsq3bja-BIZkpcsk2vz3gBnauusC8Rt6ntrLDtBDdE7y9C51OAWPUqoDnDZu8ESRrSysX_s4',
  },
]
</script>

<template>
  <section class="py-24 px-6 md:px-20 container mx-auto">
    <h2 class="font-headline text-5xl font-black italic uppercase tracking-tighter mb-12 border-b-8 border-primary-container inline-block leading-none">Press Row</h2>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-12">
      <article
        v-for="article in articles"
        :key="article.id"
        class="flex flex-col"
      >
        <div class="bg-surface-container-highest mb-6 overflow-hidden">
          <img
            :alt="article.title"
            loading="lazy"
            decoding="async"
            fetchpriority="low"
            class="w-full h-48 object-cover grayscale hover:grayscale-0 transition-all"
            :src="article.image"
          >
        </div>
        <time class="text-primary font-black uppercase text-xs mb-2">{{ article.date }}</time>
        <h3 class="font-headline text-2xl font-black italic uppercase leading-tight mb-4 hover:text-primary transition-colors cursor-pointer">
          {{ article.title }}
        </h3>
        <p class="text-on-surface-variant line-clamp-3">{{ article.excerpt }}</p>
      </article>
    </div>
  </section>
</template>
