/**
 * A clock that starts where the server left off and then ticks.
 *
 * A countdown has to start from some instant, and the browser's own clock is
 * the wrong one to start from: the page was rendered on the server a moment
 * earlier, so the first thing the browser drew would disagree with the HTML it
 * was hydrating — a mismatch Vue warns about, and a second where the page
 * contradicts itself about whether a Bout has locked.
 *
 * So it begins at the moment the server answered, which is the same number on
 * both sides, and moves to the browser's clock once mounted. On the server it
 * never ticks at all: what is rendered there is the card as it stood when it
 * was asked for.
 *
 * `startedAt` is read once and never watched, deliberately. It matters only
 * until the browser has mounted, and after that the browser's own clock is
 * both live and correct — a later answer re-seeding this would be replacing a
 * running clock with a stale reading of the same one.
 */
export function useNow(startedAt: string | null | undefined): Ref<number> {
  const answered = startedAt ? Date.parse(startedAt) : Number.NaN;
  const now = ref(Number.isNaN(answered) ? Date.now() : answered);

  let ticking: ReturnType<typeof setInterval> | undefined;

  onMounted(() => {
    now.value = Date.now();
    ticking = setInterval(() => (now.value = Date.now()), 1000);
  });

  onBeforeUnmount(() => clearInterval(ticking));

  return now;
}
