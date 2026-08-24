import { NotFoundError } from "@prismicio/client";
import type { Content } from "@prismicio/client";

/**
 * A Prismic singleton that may not exist yet.
 *
 * A model added to `customtypes/` is only the local copy until someone pushes
 * it, and the document itself is written some time after that. Pages that go
 * out before their content does read a missing document as an empty one, so
 * whatever they can say without Prismic still reaches a fan.
 *
 * Everything else Prismic can do wrong is left on `useAsyncData`'s `error`,
 * where it is reported rather than mistaken for an unwritten page.
 */
export function useOptionalSingle<TType extends Content.AllDocumentTypes["type"]>(type: TType) {
  const { client } = usePrismic();

  return useAsyncData(type, () =>
    client.getSingle(type).catch((error) => {
      if (error instanceof NotFoundError) {
        return null;
      }

      throw error;
    }),
  );
}
