"use client";

import { Loader2 } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useId, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MAX_GISTS_PER_IMPORT } from "@/lib/import";
import { responseError } from "@/lib/response-error";

interface GistRow {
  id: string;
  description: string | null;
  files: string[];
  updatedAt: string;
}

interface GistList {
  username: string | null;
  gists: GistRow[];
}

/** `GET /api/import/gists`, for a username or the linked account; null after an error toast. */
async function listGists(username: string | null, failed: string): Promise<GistList | null> {
  try {
    const query = username ? `?username=${encodeURIComponent(username)}` : "";
    const response = await fetch(`/api/import/gists${query}`);
    if (!response.ok) {
      toast.error((await responseError(response)) ?? failed);
      return null;
    }
    return (await response.json()) as GistList;
  } catch {
    toast.error(failed);
    return null;
  }
}

interface ImportGistsTabProps {
  busy: boolean;
  onImport: (request: () => Promise<Response>, total: number) => Promise<void>;
}

/** The public gists of a GitHub user (the linked account's by default), picked and imported. */
export function ImportGistsTab({ busy, onImport }: ImportGistsTabProps) {
  const t = useTranslations("settings.import");
  const failed = t("failed");
  const format = useFormatter();
  const inputId = useId();
  const [username, setUsername] = useState("");
  const [listed, setListed] = useState<string | null>(null);
  const [gists, setGists] = useState<GistRow[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // True at first: the linked account's gists are listed when the tab opens.
  const [loading, setLoading] = useState(true);

  function show(body: GistList) {
    if (!body.username) return;
    setUsername(body.username);
    setListed(body.username);
    setGists(body.gists);
    setSelected(new Set());
  }

  async function load(name: string) {
    setLoading(true);
    const body = await listGists(name, failed);
    if (body) show(body);
    setLoading(false);
  }

  useEffect(() => {
    let active = true;
    void listGists(null, failed).then((body) => {
      if (!active) return;
      if (body?.username) {
        setUsername(body.username);
        setListed(body.username);
        setGists(body.gists);
      }
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [failed]);

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else if (next.size < MAX_GISTS_PER_IMPORT) next.add(id);
      return next;
    });
  }

  async function submit() {
    const gistIds = [...selected];
    await onImport(
      () =>
        fetch("/api/import/gists", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: listed ?? undefined, gistIds }),
        }),
      gistIds.length,
    );
    setSelected(new Set());
  }

  const allSelected = gists !== null && gists.length > 0 && gists.slice(0, MAX_GISTS_PER_IMPORT).every((g) => selected.has(g.id));

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">{t("gistsPublicOnly")}</p>
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (username.trim()) void load(username.trim());
        }}
      >
        <div className="flex flex-col gap-1.5">
          <label htmlFor={inputId} className="text-sm font-medium">
            {t("gistsUser")}
          </label>
          <Input
            id={inputId}
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            autoComplete="off"
            spellCheck={false}
            maxLength={39}
            className="w-56"
            disabled={busy || loading}
          />
        </div>
        <Button type="submit" variant="outline" className="gap-2" disabled={busy || loading || !username.trim()}>
          {loading ? <Loader2 className="animate-spin" aria-hidden /> : null}
          {loading ? t("gistsLoading") : t("gistsLoad")}
        </Button>
      </form>

      {gists === null && !loading ? <p className="text-sm text-muted-foreground">{t("gistsNoUser")}</p> : null}
      {gists !== null && gists.length === 0 ? <p className="text-sm text-muted-foreground">{t("gistsEmpty")}</p> : null}

      {gists !== null && gists.length > 0 ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                className="accent-primary"
                checked={allSelected}
                disabled={busy}
                onChange={() =>
                  setSelected(allSelected ? new Set() : new Set(gists.slice(0, MAX_GISTS_PER_IMPORT).map((g) => g.id)))
                }
              />
              {t("gistsSelectAll")}
            </label>
            <span className="text-muted-foreground">
              {t("gistsSelected", { count: selected.size, max: MAX_GISTS_PER_IMPORT })}
            </span>
          </div>
          <ul className="flex max-h-80 flex-col divide-y divide-border overflow-y-auto rounded-lg border border-border">
            {gists.map((gist) => (
              <li key={gist.id}>
                <label className="flex cursor-pointer items-start gap-3 px-3 py-2 hover:bg-muted/40">
                  <input
                    type="checkbox"
                    className="mt-1 accent-primary"
                    checked={selected.has(gist.id)}
                    disabled={busy || (!selected.has(gist.id) && selected.size >= MAX_GISTS_PER_IMPORT)}
                    onChange={() => toggle(gist.id)}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{gist.description ?? gist.files[0] ?? gist.id}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {gist.files.join(", ")}
                      {gist.updatedAt ? ` · ${format.dateTime(new Date(gist.updatedAt), { dateStyle: "medium" })}` : null}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <div>
            <Button type="button" className="gap-2" disabled={busy || selected.size === 0} onClick={() => void submit()}>
              {busy ? <Loader2 className="animate-spin" aria-hidden /> : null}
              {t("importGists", { count: selected.size })}
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
}
