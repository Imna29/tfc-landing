/**
 * What one request has already worked out, so that nothing inside it works the
 * same thing out twice.
 *
 * Rendering a PlayTFC page is not one request. `/predictions` renders by
 * calling `/api/accounts/me` and `/api/predictions/entries`, each of which is
 * a request of its own made inside the render's, carrying the render's cookie.
 * Both used to read the session, and both used to sweep the card, so a single
 * page identified one fan twice over and locked the same Bouts twice. Neither
 * second answer could have differed from the first: the session was read a
 * millisecond after itself, and the second sweep looked at a card the first
 * had just swept. See ADR-0023.
 *
 * So the scope is the whole of a request *including the requests it makes*,
 * and `AsyncLocalStorage` is what makes that the same thing as "everything
 * this call tree does". `server/plugins/perRequest.ts` opens exactly one, at
 * the outermost request, and the internal calls run inside it.
 *
 * **Within a request, not across them.** Two requests share nothing, whatever
 * they overlap in time, and everything kept here is unreachable the moment the
 * request is answered. That is what keeps this a saving rather than a cache:
 * the role is read from the `users` row on every request so that revoking an
 * admin takes effect on the next one (`isAdmin` in `server/utils/session.ts`),
 * and a scope that outlived a request would quietly turn that into "on the
 * next sign-in". It is also what makes it safe — an answer about one fan can
 * never be handed to another, because the only thing that can reach it is the
 * request that asked.
 */
import { AsyncLocalStorage } from "node:async_hooks";

/**
 * The request being answered — an identity and nothing else.
 *
 * It holds no answers itself. Each question keeps its own against this, so
 * that the only way to reach an answer is to hold the question that asked it.
 */
const answering = new AsyncLocalStorage<object>();

/**
 * Runs a request with a scope of its own, unless it is already inside one.
 *
 * The "unless" is the point. Every request goes through this, including the
 * internal ones a render makes — and an internal call that opened a scope of
 * its own would be a request that shares nothing with the render it belongs
 * to, which is the whole thing this is here to stop.
 */
export function inOneRequest<T>(handle: () => T): T {
  return answering.getStore() ? handle() : answering.run({}, handle);
}

/**
 * Wraps a question so that one request asks it at most once, and answers every
 * later asker from what the first got back.
 *
 * **A question is minted once, where it is asked**, rather than named by a
 * string at each call. Two modules cannot then pick the same name and silently
 * share an answer, and one module cannot spell its own name two ways and
 * silently ask twice — which is the failure that would make this look like it
 * still worked while saving nothing. Each wrapper keeps its own answers, so
 * holding the wrapper is the only way to reach them.
 *
 * `about` is what makes two asks the *same* question. It defaults to saying
 * they always are, which is right for a question that has no subject — the
 * Locks that have fallen due are the same Locks whoever asks. A question that
 * does have one says so: the fan making a request is a question about a
 * cookie, and an ask carrying a different cookie, or none, is a different
 * question and is asked. Whatever `about` returns lives in memory for the
 * length of one request and is never written anywhere, which is what makes a
 * session cookie usable as one.
 *
 * The promise is what is kept, not the value it settles to, so that two askers
 * arriving before either answer does share one question rather than asking
 * two — which is exactly what a render making its internal calls at once looks
 * like.
 *
 * Asked outside any scope, this simply asks. That is a test calling a server
 * module directly, and a module that only worked inside a request would be a
 * module those tests could not reach.
 */
export function askedOncePerRequest<Of, T>(
  ask: (of: Of) => Promise<T>,
  about: (of: Of) => string = () => "the only one there is",
): (of: Of) => Promise<T> {
  // Keyed by the request itself, so an answer becomes unreachable when the
  // request that asked does, without anything having to clear it up.
  const answered = new WeakMap<object, Map<string, Promise<T>>>();

  return (of) => {
    const request = answering.getStore();

    if (!request) return ask(of);

    const answers = answered.get(request) ?? new Map<string, Promise<T>>();

    answered.set(request, answers);

    const subject = about(of);
    const already = answers.get(subject);

    if (already) return already;

    const answer = ask(of);

    answers.set(subject, answer);

    return answer;
  };
}
