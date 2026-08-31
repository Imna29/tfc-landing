<script setup lang="ts">
import { coinsLabel } from "#shared/coins";
import {
  AMOUNT,
  ENTRY_MESSAGES,
  ENTRY_PREDICTIONS,
  potentialReward,
  predictionLabel,
  predictionMultiplier,
  type DraftPrediction,
} from "#shared/entries";
import type { Fan } from "#shared/fan";
import { multiplierLabel } from "#shared/predictions";

/**
 * The Entry a fan is building, and the button that commits it.
 *
 * Everything a fan needs before they can press it is here and updates as they
 * pick: the Predictions in the Entry, the combined Multiplier, whether the cap
 * has decided it, and the Coins it returns if it lands. Nobody should have to
 * work out what they stand to win — ADR-0002 chose fixed Multipliers over a
 * self-balancing pool precisely so that they do not have to.
 *
 * The Balance comes from {@link useBalance} rather than from a prop, so that
 * the number here and the number in the site header are the same number: this
 * is one of the places the header learns its answer has changed.
 */
const props = defineProps<{
  /** What the fan has answered so far, priced, in card order. */
  predictions: DraftPrediction[];
  /** Who is submitting, or null for a visitor with no account. */
  fan: Fan | null;
}>();

const emit = defineEmits<{ remove: [boutId: string]; submitted: [] }>();

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
        predictions: props.predictions.map(({ boutId, corner, method, round }) => ({
          boutId,
          corner,
          method,
          round,
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
  <aside class="border border-outline-variant/20 bg-surface-container-low p-6">
    <h2 class="font-headline text-lg font-black italic uppercase">Your Entry</h2>

    <p class="mt-2 text-xs uppercase tracking-widest text-on-surface/60">
      {{ predictions.length }} of {{ ENTRY_PREDICTIONS.maximum }} Predictions
    </p>

    <ol v-if="predictions.length > 0" class="mt-6 flex flex-col gap-3">
      <li
        v-for="prediction in predictions"
        :key="prediction.boutId"
        class="flex items-start justify-between gap-3 border-b border-outline-variant/10 pb-3"
      >
        <div>
          <p class="text-xs font-bold uppercase tracking-widest text-on-surface/60">
            Bout {{ prediction.cardOrder }}
          </p>
          <p class="mt-1 text-sm">{{ predictionLabel(prediction, prediction.corners) }}</p>
        </div>

        <div class="flex shrink-0 items-baseline gap-3">
          <span class="text-sm font-bold tabular-nums">
            {{ multiplierLabel(predictionMultiplier(prediction)) }}
          </span>
          <button
            type="button"
            class="text-xs uppercase tracking-widest text-on-surface/60 hover:text-primary"
            @click="emit('remove', prediction.boutId)"
          >
            Remove
          </button>
        </div>
      </li>
    </ol>

    <div v-if="predictions.length > 0" class="mt-6 border-t border-outline-variant/15 pt-6">
      <label class="block">
        <span class="font-headline text-xs font-black uppercase tracking-widest text-on-surface/60">
          Coins to commit
        </span>
        <input
          v-model.number="amount"
          type="number"
          :min="AMOUNT.minimum"
          step="1"
          inputmode="numeric"
          class="mt-2 w-full border border-outline-variant/40 bg-transparent px-4 py-3 tabular-nums"
        />
      </label>

      <dl class="mt-6 flex flex-col gap-2 text-sm">
        <div class="flex items-baseline justify-between gap-3">
          <dt class="uppercase tracking-widest text-on-surface/60">Combined Multiplier</dt>
          <dd class="font-bold tabular-nums">{{ multiplierLabel(returns.multiplier) }}</dd>
        </div>
        <div class="flex items-baseline justify-between gap-3">
          <dt class="uppercase tracking-widest text-on-surface/60">Returns</dt>
          <dd class="font-headline text-xl font-black tabular-nums text-primary">
            {{ coinsLabel(returns.reward) }}
          </dd>
        </div>
      </dl>

      <p v-if="returns.capped" class="mt-3 text-xs text-on-surface/70">
        {{ ENTRY_MESSAGES.capped }}
      </p>
    </div>

    <p v-if="blocked" class="mt-6 text-sm text-error" role="status">{{ blocked }}</p>

    <p v-else-if="hint" class="mt-6 text-sm text-on-surface/70">{{ hint }}</p>

    <button
      type="button"
      :disabled="submitting || predictions.length === 0"
      class="mt-6 w-full bg-primary-container px-8 py-4 font-headline font-black uppercase tracking-widest text-white disabled:opacity-60"
      @click="submit"
    >
      {{ submitting ? "Committing…" : "Submit Entry" }}
    </button>

    <p v-if="problem" class="mt-4 text-sm text-error" role="alert">
      {{ problem }}
      <NuxtLink v-if="!fan" to="/account/sign-in" class="underline">Sign in</NuxtLink>
    </p>

    <p v-if="accepted" class="mt-4 text-sm text-primary" role="status">{{ accepted }}</p>
  </aside>
</template>
