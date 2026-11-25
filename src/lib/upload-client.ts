import type { UploadKind } from "@/lib/files";

/**
 * Sends a file to `/api/upload` and resolves with its R2 key. XHR rather than
 * `fetch`, because only XHR reports upload progress. `onProgress` gets 0 to 1.
 * Rejects with an `Error` whose message can be shown to the user: the route's own error, already in
 * the user's language, or one of `messages` when there is none.
 */
export function uploadFile(
  kind: UploadKind,
  file: File,
  onProgress: (fraction: number) => void,
  messages: { failed: string; network: string },
): Promise<string> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", "/api/upload");
    request.responseType = "json";

    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    request.onload = () => {
      const body = request.response as { key?: string; error?: string } | null;
      if (request.status === 201 && body?.key) {
        onProgress(1);
        resolve(body.key);
      } else {
        reject(new Error(body?.error ?? messages.failed));
      }
    };
    request.onerror = () => reject(new Error(messages.network));

    const form = new FormData();
    form.set("kind", kind);
    form.set("file", file);
    request.send(form);
  });
}
