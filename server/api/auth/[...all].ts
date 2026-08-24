/**
 * Everything `better-auth` serves: signing in, signing out, verifying an email
 * address and resetting a password, all under `/api/auth`.
 *
 * Signing *up* has a route of its own — `/api/accounts/sign-up` — which speaks
 * this domain's vocabulary and answers with every problem at once. The sign-up
 * route here still works and is still safe: the eligibility rules live in a
 * database hook that no route can go around.
 *
 * The whole handler is watched for email, because `better-auth` composes and
 * sends inside its own routes and swallows what the sending fails with: its
 * `/request-password-reset` answers 200 whether or not anything left. Watching
 * here rather than in each route means a fan reaching one of these directly —
 * and any route a later version of `better-auth` adds — cannot be told a link
 * is on its way when it is not.
 */
export default defineEventHandler(async (event) => {
  const { result, sent } = await sendingEmail(() => useAuth().handler(toWebRequest(event)));

  if (!sent || !result) throw createError(EMAIL_NOT_SENT);

  return result;
});
