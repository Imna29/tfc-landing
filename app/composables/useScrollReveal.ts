import { ref, onMounted, onUnmounted, nextTick, type Ref } from "vue";

export interface ScrollRevealOptions {
  threshold?: number;
  rootMargin?: string;
  once?: boolean;
  immediate?: boolean;
}

export function useScrollReveal(
  targetRef: Ref<HTMLElement | null>,
  options: ScrollRevealOptions = {}
) {
  const {
    threshold = 0.15,
    rootMargin = "0px 0px -40px 0px",
    once = true,
    immediate = false,
  } = options;

  const isInView = ref(immediate);
  const hasAnimated = ref(immediate);
  let observer: IntersectionObserver | null = null;

  const startObserving = async () => {
    await nextTick();
    const el = targetRef.value;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const isAboveFold = rect.top < window.innerHeight && rect.bottom > 0;

    if (isAboveFold) {
      isInView.value = true;
      hasAnimated.value = true;
      if (once) return;
    }

    observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            isInView.value = true;
            hasAnimated.value = true;
            if (once) {
              observer?.unobserve(entry.target);
            }
          } else if (!once) {
            isInView.value = false;
          }
        });
      },
      { threshold, rootMargin }
    );

    observer.observe(el);
  };

  onMounted(() => {
    startObserving();
  });

  onUnmounted(() => {
    observer?.disconnect();
  });

  return { isInView, hasAnimated };
}

export function useStaggerReveal(
  parentRef: Ref<HTMLElement | null>,
  childSelector: string,
  options: ScrollRevealOptions & { staggerDelay?: number } = {}
) {
  const {
    threshold = 0.1,
    rootMargin = "0px 0px -40px 0px",
    once = true,
    immediate = false,
    staggerDelay = 100,
  } = options;

  const childStates = ref<Record<string, boolean>>({});
  const allInView = ref(immediate);
  let observer: IntersectionObserver | null = null;

  const startObserving = async () => {
    await nextTick();
    const parent = parentRef.value;
    if (!parent) return;

    const children = parent.querySelectorAll<HTMLElement>(childSelector);
    if (!children.length) return;

    children.forEach((child, index) => {
      const id = child.dataset.animateId || `${child.tagName}-${index}`;
      child.dataset.animateId = id;

      const rect = child.getBoundingClientRect();
      const isAboveFold = rect.top < window.innerHeight && rect.bottom > 0;

      if (isAboveFold || immediate) {
        setTimeout(() => {
          childStates.value[id] = true;
        }, index * staggerDelay);
      }
    });

    observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const el = entry.target as HTMLElement;
            const id = el.dataset.animateId;
            const index = Array.from(children).indexOf(el);

            if (id) {
              setTimeout(() => {
                childStates.value[id] = true;
              }, index * staggerDelay);
            }

            if (once) {
              observer?.unobserve(entry.target);
            }
          }
        });
      },
      { threshold, rootMargin }
    );

    children.forEach((child) => {
      const id = child.dataset.animateId;
      if (!once || !id || !childStates.value[id]) {
        observer?.observe(child);
      }
    });

    allInView.value = Object.values(childStates.value).every(Boolean);
  };

  onMounted(() => {
    startObserving();
  });

  onUnmounted(() => {
    observer?.disconnect();
  });

  return { childStates, allInView };
}
