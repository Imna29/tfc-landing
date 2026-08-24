import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { chooseMailer, createResendMailer } from "../../server/utils/email";
import { startMailbox, type Mailbox } from "../helpers/mailbox";

const message = {
  to: "nino@example.com",
  subject: "Confirm your email address",
  text: "Welcome to TFC Predictions.",
  html: "<p>Welcome to TFC Predictions.</p>",
};

const FROM = "TFC Predictions <no-reply@mail.tfcgeo.com>";

describe("the Resend transport", () => {
  let mailbox: Mailbox;

  beforeAll(async () => {
    mailbox = await startMailbox();
  });

  afterAll(() => mailbox.close());
  afterEach(() => mailbox.clear());

  function mailer() {
    return createResendMailer({ apiKey: "re_a_test_key", from: FROM, baseUrl: mailbox.url });
  }

  it("hands the message to Resend, from the address TFC has verified", async () => {
    await mailer().send(message);

    expect(mailbox.sent).toEqual([
      { ...message, from: FROM, authorization: "Bearer re_a_test_key" },
    ]);
  });

  it("fails loudly when Resend refuses the message", async () => {
    mailbox.refuseNext();

    await expect(mailer().send(message)).rejects.toThrow(/resend/i);
  });

  it("says what Resend said, so a failure can be acted on", async () => {
    mailbox.refuseNext();

    await expect(mailer().send(message)).rejects.toThrow(/something went wrong at resend/i);
  });

  it("keeps the API key out of the failure it reports", async () => {
    mailbox.refuseNext();

    await expect(mailer().send(message)).rejects.not.toThrow(/re_a_test_key/);
  });

  it("fails rather than hanging when Resend cannot be reached at all", async () => {
    const unreachable = createResendMailer({
      apiKey: "re_a_test_key",
      from: FROM,
      // A port nothing is listening on: the connection is refused at once.
      baseUrl: "http://127.0.0.1:1",
    });

    await expect(unreachable.send(message)).rejects.toThrow();
  });
});

describe("choosing a mailer", () => {
  it("sends through Resend once there is a key and a verified sender", async () => {
    const mailbox = await startMailbox();

    try {
      const mailer = chooseMailer({
        RESEND_API_KEY: "re_a_test_key",
        RESEND_BASE_URL: mailbox.url,
        EMAIL_FROM: FROM,
        BETTER_AUTH_URL: "https://tfcgeo.com",
      });

      await mailer.send(message);

      expect(mailbox.sent).toHaveLength(1);
    } finally {
      await mailbox.close();
    }
  });

  it("refuses a key without a sender, because a domain has to be verified first", () => {
    expect(() => chooseMailer({ RESEND_API_KEY: "re_a_test_key" })).toThrow(/EMAIL_FROM/);
  });

  it("refuses to send real email carrying links to a development server", () => {
    expect(() => chooseMailer({ RESEND_API_KEY: "re_a_test_key", EMAIL_FROM: FROM })).toThrow(
      /BETTER_AUTH_URL/,
    );
  });

  it("writes the message to the log when there is no key, so development needs no DNS", async () => {
    const logged = vi.spyOn(console, "info").mockImplementation(() => {});

    try {
      await chooseMailer({}).send(message);

      expect(logged).toHaveBeenCalledWith(expect.stringContaining("nino@example.com"));
    } finally {
      logged.mockRestore();
    }
  });
});
