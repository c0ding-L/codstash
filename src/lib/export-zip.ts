// The ZIP export's entries, in order, for `client-zip`'s `makeZip`. An async generator,
// so `makeZip` pulls one entry at a time: one R2 object in flight, nothing buffered.

import {
  exportJsonChunks,
  fileEntryPath,
  isTextEntry,
  itemEntryPath,
  linksMarkdown,
  renderItemText,
  type ExportHeader,
  type ExportItemRow,
} from "@/lib/export";

export interface ZipEntry {
  name: string;
  lastModified: Date;
  input: string | ReadableStream<Uint8Array> | AsyncIterable<string>;
}

interface ZipEntriesOptions {
  header: ExportHeader;
  /** Called once per pass: the JSON, then the files. */
  itemPages: () => AsyncIterable<ExportItemRow[]>;
  getObject: (key: string) => Promise<{ body: ReadableStream } | null>;
  now: Date;
}

/**
 * `data.json` first, then each text item, each stored file, `links.md` and, when some
 * stored files could not be read, `missing-files.txt` last. A missing or unreadable
 * object never fails the export.
 */
export async function* zipEntries({ header, itemPages, getObject, now }: ZipEntriesOptions): AsyncGenerator<ZipEntry> {
  yield { name: "data.json", lastModified: now, input: exportJsonChunks(header, itemPages()) };

  const links: ExportItemRow[] = [];
  const missing: string[] = [];

  for await (const page of itemPages()) {
    for (const row of page) {
      if (row.contentType === "file") {
        const name = fileEntryPath(row);
        const object = row.fileUrl ? await readObject(getObject, row.fileUrl) : null;
        if (object) yield { name, lastModified: row.updatedAt, input: object.body };
        else missing.push(`${name} (item "${row.title}", ${row.id})`);
      } else if (row.type.slug === "link") {
        links.push(row);
      } else if (isTextEntry(row)) {
        yield { name: itemEntryPath(row), lastModified: row.updatedAt, input: renderItemText(row) };
      }
    }
  }

  if (links.length > 0) yield { name: "links.md", lastModified: now, input: linksMarkdown(links) };
  if (missing.length > 0) {
    yield {
      name: "missing-files.txt",
      lastModified: now,
      input: `These files could not be read from storage and are not in this archive:\n\n${missing.join("\n")}\n`,
    };
  }
}

async function readObject(getObject: ZipEntriesOptions["getObject"], key: string) {
  try {
    return await getObject(key);
  } catch (error) {
    console.error(`[export] could not read ${key}:`, error);
    return null;
  }
}
