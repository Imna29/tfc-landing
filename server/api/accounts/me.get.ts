/**
 * The signed-in fan, as they are allowed to see themselves.
 *
 * Answers 401 with something to act on when nobody is signed in, which is what
 * makes this the route a signed-out visitor is bounced off.
 */
export default defineEventHandler(async (event) => {
  const { username, email, emailVerified } = await requireFan(event);

  return { username, email, emailVerified };
});
