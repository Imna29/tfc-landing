import { ref } from "vue";

export interface MMASpringOptions {
  stiffness?: number;
  damping?: number;
  mass?: number;
}

export const mmaSpring = {
  snappy: { stiffness: 400, damping: 25, mass: 0.8 },
  heavy: { stiffness: 200, damping: 20, mass: 1.2 },
  bounce: { stiffness: 300, damping: 12, mass: 1 },
  smooth: { stiffness: 150, damping: 25, mass: 1 },
};

/**
 * Utility to trigger a CSS-based digit bounce animation.
 * Returns a ref to bind to the element and a trigger function.
 */
export function useDigitAnimate() {
  const digitRef = ref<HTMLElement | null>(null);
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const bounce = () => {
    if (!digitRef.value) return;

    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    digitRef.value.classList.remove("digit-bounce");
    void digitRef.value.offsetWidth; // force reflow
    digitRef.value.classList.add("digit-bounce");

    timeoutId = setTimeout(() => {
      digitRef.value?.classList.remove("digit-bounce");
    }, 300);
  };

  return { digitRef, bounce };
}
