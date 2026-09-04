<script setup lang="ts">
import { coinsLabel } from "#shared/coins";
import {
  AMOUNT,
  ENTRY_MESSAGES,
  ENTRY_PREDICTIONS,
  potentialReward,
  type DraftPrediction,
} from "#shared/entries";
import type { Fan } from "#shared/fan";
import { multiplierLabel } from "#shared/predictions";
import { outcomeLabel } from "#shared/pricing";
import { CORNER_COLOURS } from "~/utils/corners";

/**
 * The Entry a fan is building, and the button that commits it.
 *
 * Everything a fan needs before they can press it is here and updates as they
 * pick: the Predictions in the Entry, the combined Multiplier, whether the cap
 * has decided it, and the Coins it returns if it lands. Nobody should have to
 * work out what they stand to win — ADR-0002 chose fixed Multipliers over a
 * self-balancing pool precisely so that they do not have to.
 *
 * **It follows the fan down the card.** Beside it on a wide window, and along
 * the bottom edge of a narrow one, where it shows what the Entry holds and
 * what it returns in one line and opens to the rest. A panel that scrolled
 * away would leave a fan answering the ninth Bout with no idea what the first
 * eight are now worth, which is the number the whole page is about.
 *
 * The Balance comes from {@link useBalance} rather than from a prop, so that
 * the number here and the number in the game's header are the same number:
 * this is one of the places the header learns its answer has changed.
 */
const props = defineProps<{
  /** What the fan has answered so far, priced, in card order. */
  predictions: DraftPrediction[];
  /** Who is submitting, or null for a visitor with no account. */
  fan: Fan | null;
}>();

const emit = defineEmits<{ remove: [boutId: string]; clear: []; submitted: [] }>();

/** The Amount the panel opens on, for a fan whose Balance covers it. */
const DEFAULT_AMOUNT = 10;

const { balance, load, refresh } = useBalance();

onMounted(load);

/**
 * The Amount, as it is typed.
 *
 * A number the fan can commit rather than a blank box, because most of an
 * Entry is already decided by the time they reach this and the Amount is the
 * one field that has a sensible default. It follows the Balance down when the
 * Balance cannot cover it, so nobody opens the panel already refused.
 */
const amount = ref(DEFAULT_AMOUNT);

watch(balance, (held) => {
  if (held !== null && held >= AMOUNT.minimum && amount.value > held) amount.value = held;
});

const submitting = ref(false);
const problem = ref("");
const accepted = ref("");

/**
 * Whether the panel is expanded, on the narrow windows where it is a sheet
 * along the bottom edge rather than a column beside the card.
 *
 * A single line until the fan asks for more, and it stays that way when they
 * answer a Bout. A sheet that opened itself over the card would cover the Bout
 * that had just been tapped, at the moment a fan is looking at what their
 * answer did to it — the line along the bottom already says what the Entry
 * holds and what it returns, which is what they need while they keep picking.
 *
 * The whole bar opens it, not only the chevron: a 36px target at the bottom of
 * a phone screen is a thing to miss. The chevron stays because it is the part
 * a keyboard reaches and the part that says the bar does anything at all.
 */
const expanded = ref(false);

/**
 * What this Entry returns if every Prediction in it lands.
 *
 * An Amount that is not a number of Coins returns nothing rather than
 * something unreadable: `v-model.number` hands back an empty string for an
 * emptied box, and "NaN Coins" is not a Reward anybody can weigh up. What is
 * wrong with it is said in {@link hint} instead.
 */
const returns = computed(() =>
  potentialReward(isAnAmount(amount.value) ? amount.value : 0, props.predictions),
);

/**
 * What is standing between this fan and an Entry, whatever they have picked.
 *
 * Shown before they press anything rather than after, because an unconfirmed
 * address is not something a fan can fix from this page in the moment — and
 * being told at the last step, having built a Chained Entry, is the worst
 * moment to learn it.
 */
const blocked = computed(() =>
  props.fan && !props.fan.emailVerified ? ENTRY_MESSAGES.emailUnverified : "",
);

/** What to say about the Entry as it stands, if anything. */
const hint = computed(() => {
  if (props.predictions.length === 0) return ENTRY_MESSAGES.nothingPicked;
  if (!isAnAmount(amount.value)) return ENTRY_MESSAGES.amount;
  if (balance.value !== null && amount.value > balance.value) {
    return ENTRY_MESSAGES.notEnoughCoins(balance.value);
  }

  return "";
});

function isAnAmount(value: number): boolean {
  return Number.isInteger(value) && value >= AMOUNT.minimum;
}

/**
 * Commits the Entry.
 *
 * The refusals asked about here are the ones this page already knows the
 * answer to, so that a fan is told without a round trip. Everything else is
 * the server's to refuse, and it answers with a sentence this shows as it is:
 * the card may have moved since the page was rendered, and only the server
 * knows that.
 */
async function submit() {
  problem.value = "";
  accepted.value = "";

  if (!props.fan) {
    problem.value = ENTRY_MESSAGES.signIn;
    return;
  }

  if (blocked.value || hint.value) {
    problem.value = blocked.value || hint.value;
    return;
  }

  submitting.value = true;

  try {
    const { entry } = await $fetch("/api/predictions/entries", {
      method: "POST",
      body: {
        amount: amount.value,
        predictions: props.predictions.map(({ boutId, question, corner, method }) => ({
          boutId,
          question,
          corner,
          method,
        })),
      },
    });

    accepted.value = ENTRY_MESSAGES.accepted(entry.amount, entry.reward);

    // The Coins left the Balance the moment that answered, so the header is
    // wrong until it is told.
    await refresh();
    emit("submitted");
  } catch (failure) {
    problem.value = problemFrom(failure);
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <aside
    class="entry-panel border border-outline-variant/20 bg-surface-container-low"
    :class="{ 'entry-panel--expanded': expanded }"
  >
    <div
      class="entry-panel__head flex items-center gap-3 border-b border-outline-variant/15 px-5 py-4"
      @click="expanded = !expanded"
    >
      <h2 class="font-headline text-lg font-black italic uppercase">Your Entry</h2>

      <p class="text-xs uppercase tracking-widest text-on-surface/60">
        {{ predictions.length }} of {{ ENTRY_PREDICTIONS.maximum }}
      </p>

      <div class="ml-auto flex items-center gap-3 lg:hidden">
        <p v-if="predictions.length > 0" class="flex items-center gap-2">
          <TfcCoin class="w-4 h-4" />
          <span class="sr-only">Returns</span>
          <span class="font-headline text-base font-black tabular-nums text-coin">
            {{ coinsLabel(returns.reward) }}
          </span>
        </p>

        <button
          type="button"
          class="-mr-2 flex h-9 w-9 shrink-0 items-center justify-center"
          :aria-expanded="expanded"
          aria-controls="entry-panel-body"
          aria-label="The Entry you are building"
          @click.stop="expanded = !expanded"
        >
          <Icon
            :name="expanded ? 'material-symbols:expand-more' : 'material-symbols:expand-less'"
          />
        </button>
      </div>
    </div>

    <div id="entry-panel-body" class="entry-panel__body">
      <ol v-if="predictions.length > 0" class="max-h-[42vh] overflow-y-auto lg:max-h-none">
        <li
          v-for="prediction in predictions"
          :key="prediction.boutId"
          class="flex items-start gap-3 border-b border-outline-variant/10 px-5 py-3"
        >
          <span
            class="mt-1 h-8 w-1 shrink-0"
            :class="CORNER_COLOURS[prediction.corner].fill"
            aria-hidden="true"
          />

          <div class="min-w-0 flex-1">
            <p class="text-xs font-bold uppercase tracking-widest text-on-surface/50">
              Bout {{ prediction.cardOrder }}
            </p>
            <p class="mt-0.5 text-sm">{{ outcomeLabel(prediction, prediction.corners) }}</p>
          </div>

          <div class="flex shrink-0 flex-col items-end gap-1">
            <span class="font-headline text-sm font-black tabular-nums text-coin">
              {{ multiplierLabel(prediction.multiplier) }}
            </span>
            <button
              type="button"
              class="text-xs uppercase tracking-widest text-on-surface/50 hover:text-primary"
              @click="emit('remove', prediction.boutId)"
            >
              Remove
            </button>
          </div>
        </li>
      </ol>

      <div v-if="predictions.length > 0" class="px-5 py-4">
        <button
          type="button"
          class="mb-4 ml-auto block text-xs uppercase tracking-widest text-on-surface/50 hover:text-primary"
          @click="emit('clear')"
        >
          Clear all
        </button>

        <label class="block">
          <span
            class="font-headline text-xs font-black uppercase tracking-widest text-on-surface/60"
          >
            Coins to commit
          </span>
          <span class="mt-2 flex items-center gap-3 border border-outline-variant/40 px-4 py-3">
            <TfcCoin class="w-5 h-5 shrink-0" />
            <input
              v-model.number="amount"
              type="number"
              :min="AMOUNT.minimum"
              step="1"
              inputmode="numeric"
              class="w-full bg-transparent font-headline text-xl font-black tabular-nums focus:outline-none"
            />
          </span>
        </label>

        <dl class="mt-5 grid grid-cols-2 gap-4">
          <div>
            <dt class="text-xs uppercase tracking-widest text-on-surface/50">Combined</dt>
            <dd class="mt-1 font-headline text-2xl font-black tabular-nums text-coin">
              {{ multiplierLabel(returns.multiplier) }}
            </dd>
          </div>
          <div class="text-right">
            <dt class="text-xs uppercase tracking-widest text-on-surface/50">Returns</dt>
            <dd class="mt-1 font-headline text-2xl font-black tabular-nums text-primary">
              {{ coinsLabel(returns.reward) }}
            </dd>
          </div>
        </dl>

        <p v-if="returns.capped" class="mt-3 text-xs text-on-surface/70 leading-relaxed">
          {{ ENTRY_MESSAGES.capped }}
        </p>
      </div>

      <div class="px-5 pb-5">
        <p v-if="blocked" class="mb-4 text-sm text-error" role="status">{{ blocked }}</p>

        <p v-else-if="hint" class="mb-4 text-sm text-on-surface/70 leading-relaxed">{{ hint }}</p>

        <button
          type="button"
          :disabled="submitting || predictions.length === 0"
          class="w-full bg-primary-container px-8 py-4 font-headline font-black uppercase tracking-widest text-white transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
          @click="submit"
        >
          {{ submitting ? "Committing…" : "Submit Entry" }}
        </button>

        <p v-if="problem" class="mt-4 text-sm text-error" role="alert">
          {{ problem }}
          <NuxtLink v-if="!fan" to="/account/sign-in" class="underline">Sign in</NuxtLink>
        </p>

        <p v-if="accepted" class="mt-4 text-sm text-primary" role="status">{{ accepted }}</p>
      </div>
    </div>
  </aside>
</template>

<style scoped>
/*
  Below the width the card and the panel stop fitting side by side, the panel
  is the bottom edge of the window: one line of it showing what the Entry
  returns, and the rest a tap away. `translateY` rather than a collapsed
  height, so what it holds is measured and scrollable whether or not it is
  open.
*/
@media (max-width: 1023px) {
  .entry-panel {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 40;
    display: flex;
    max-height: 85vh;
    flex-direction: column;
    border-left: 0;
    border-right: 0;
    border-bottom: 0;
    transform: translateY(calc(100% - 3.75rem));
    transition: transform 0.25s ease;
  }

  .entry-panel--expanded {
    transform: none;
  }

  .entry-panel__head {
    flex: none;
  }

  .entry-panel__body {
    flex: 1;
    overflow-y: auto;
  }
}

@media (prefers-reduced-motion: reduce) {
  .entry-panel {
    transition: none;
  }
}
</style>
