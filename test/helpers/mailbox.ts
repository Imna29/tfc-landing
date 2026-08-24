import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";

/** One message Resend was asked to send, as it arrived on the wire. */
export interface CapturedEmail {
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
  /** What the app authenticated with, so a test can prove it did. */
  authorization: string | null;
}

export interface Mailbox {
  /** What the app should be told Resend lives at. */
  url: string;
  /** Every message it was asked to send, in the order it asked. */
  sent: CapturedEmail[];
  /** The last message sent to an address, or `undefined` if there was none. */
  lastTo(address: string): CapturedEmail | undefined;
  /** Refuse the next `count` messages, the way a mail provider having a bad day does. */
  refuseNext(count?: number): void;
  clear(): void;
  close(): Promise<void>;
}

/**
 * A stand-in for Resend: the same HTTP API, on a local port, keeping what it
 * was asked to send.
 *
 * Nothing is mocked here either. The app under test builds a real request and
 * makes it, so a test that reads a link out of this mailbox has proved the
 * transport composes and authenticates a message correctly — which a stubbed
 * `fetch` would only have proved about the stub.
 */
export async function startMailbox(): Promise<Mailbox> {
  const sent: CapturedEmail[] = [];
  let refusals = 0;

  const server = createServer((request, response) => {
    readBody(request)
      .then((body) => {
        if (request.method !== "POST" || !request.url?.startsWith("/emails")) {
          return answer(response, 404, { message: "Not found" });
        }

        if (refusals > 0) {
          refusals -= 1;
          return answer(response, 500, {
            name: "internal_server_error",
            message: "Something went wrong at Resend.",
          });
        }

        const message = JSON.parse(body) as Omit<CapturedEmail, "authorization">;

        sent.push({ ...message, authorization: request.headers.authorization ?? null });

        return answer(response, 200, { id: `message-${sent.length}` });
      })
      .catch(() => answer(response, 400, { message: "Unreadable request" }));
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));

  return {
    url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    sent,
    lastTo: (address) => sent.filter((message) => message.to === address).at(-1),
    refuseNext: (count = 1) => {
      refusals = count;
    },
    clear: () => {
      sent.length = 0;
      refusals = 0;
    },
    close: () => closeServer(server),
  };
}

/**
 * The first link in a message, as a fan's mail client would offer it.
 *
 * Read out of the plain text half rather than the HTML, because that half is
 * the one with nothing escaped in it.
 */
export function linkIn(message: CapturedEmail): string {
  const found = /https?:\/\/\S+/.exec(message.text);

  if (!found) throw new Error(`No link in the message "${message.subject}".`);

  return found[0];
}

/** A link as `@nuxt/test-utils` wants to be asked for it: path and query only. */
export function pathOf(link: string): string {
  const { pathname, search } = new URL(link);

  return `${pathname}${search}`;
}

function readBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = "";

    request.setEncoding("utf8");
    request.on("data", (chunk: string) => {
      body += chunk;
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

function answer(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.closeAllConnections();
    server.close((error) => (error ? reject(error) : resolve()));
  });
}
