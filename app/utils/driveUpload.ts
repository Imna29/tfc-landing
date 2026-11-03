/**
 * Sends one file to a Drive upload URL and answers with the id Drive gave it.
 *
 * The URL comes from `/api/fighter-registration/uploads`, which opened the
 * upload on the account that owns the registration sheets; the URL itself is
 * what lets this browser write to it, so no Google sign-in is involved.
 *
 * `XMLHttpRequest` rather than `fetch`, because only it reports how much of a
 * request body has been sent, and a fighter watching a 1 GB video go up needs
 * to see that it is moving.
 */
export function sendToDrive(
  uploadUrl: string,
  file: File,
  onProgress: (sentBytes: number) => unknown,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();

    request.open("PUT", uploadUrl);
    request.upload.addEventListener("progress", (event) => onProgress(event.loaded));

    request.addEventListener("load", () => {
      const id = request.status < 300 ? idIn(request.responseText) : undefined;

      if (id) {
        resolve(id);
      } else {
        reject(new Error(`Drive answered ${request.status} to the upload of ${file.name}.`));
      }
    });
    request.addEventListener("error", () =>
      reject(new Error(`The upload of ${file.name} was interrupted.`)),
    );

    request.send(file);
  });
}

function idIn(responseText: string): string | undefined {
  try {
    const { id } = JSON.parse(responseText) as { id?: unknown };

    return typeof id === "string" ? id : undefined;
  } catch {
    return undefined;
  }
}
