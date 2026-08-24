/**
 * Everything `better-auth` serves: signing in, signing out, verifying an email
 * address and resetting a password, all under `/api/auth`.
 *
 * Signing *up* has a route of its own — `/api/accounts/sign-up` — which speaks
 * this domain's vocabulary and answers with every problem at once. The sign-up
 * route here still works and is still safe: the eligibility rules live in a
 * database hook that no route can go around.
 */
export default defineEventHandler((event) => useAuth().handler(toWebRequest(event)));
