# CodStash REST API v1

A small JSON API for the CLI, scripts and other tools. Every path starts with `/api/v1`. The
examples read the base URL from `$CORTEX_URL`, for example `http://localhost:3000` in
development.

## Authentication

Create a token in **Settings › API tokens**, then send it as a bearer token on every request:

```bash
export CORTEX_URL=http://localhost:3000
export CORTEX_TOKEN=cstash_...
curl -H "Authorization: Bearer $CORTEX_TOKEN" $CORTEX_URL/api/v1/me
```

- A **Read** token can call every `GET` endpoint. Read tokens are free.
- A **Read + write** token can also create and edit items. Writing needs an active Pro plan. If
  Pro lapses, the token can still read but its writes get `403 pro_required`.
- The token is shown only once, when it is created. Revoke it from Settings if it leaks.
  Changing or resetting your password revokes every token.

There is no `DELETE` in v1, so a leaked write token can add and edit items but cannot delete
them.

## Responses

- Success: `{ "data": ... }`, or `{ "data": [...], "nextCursor": "..." }` for a list.
- Dates are ISO 8601 strings in UTC, for example `"2026-11-27T10:00:00.000Z"`.
- Error: `{ "error": { "code": "...", "message": "..." } }`. A `422` also carries
  `details: [{ "path": "title", "message": "Title is required." }]`.
- Messages are always in English.

## Limits

- Each token can make 120 requests per minute. Writes are limited to 30 per minute, counted on top
  of that. Over a limit, the API answers `429 rate_limited` with a `Retry-After` header in seconds.
- List pages hold at most 50 items.
- The item fields have the same limits as in the app: a title of up to 200 characters, a
  description of up to 2,000, content of up to 100,000, at most 20 tags of up to 50 characters
  each, and at most 20 collections.

## Endpoints

### `GET /api/v1/me` (read)

The token's owner and plan.

```bash
curl -H "Authorization: Bearer $CORTEX_TOKEN" $CORTEX_URL/api/v1/me
```

```json
{
  "data": {
    "id": "cm...",
    "name": "Ada",
    "email": "ada@example.com",
    "isPro": true,
    "proUntil": "2027-01-01T00:00:00.000Z",
    "limits": {
      "items": { "used": 72, "max": null },
      "collections": { "used": 4, "max": null }
    }
  }
}
```

`max` is the Free plan's cap (50 items, 3 collections), or `null` on Pro.

### `GET /api/v1/items` (read)

A page of your items, most recently updated first.

| Query | Meaning |
| --- | --- |
| `q` | Matches text in the title, description or content (case-insensitive), or an exact tag name. |
| `type` | A type slug: `snippet`, `prompt`, `command`, `note`, `link`, `file`, `image`, or one of your custom types' slugs. |
| `tag` | An exact tag name. |
| `collection` | A collection id. |
| `idSuffix` | The last 8 characters of an item id, as the CLI shows them. |
| `limit` | From 1 to 50, 20 by default. A higher value is lowered to 50. |
| `cursor` | The `nextCursor` of the previous page. |

```bash
curl -G -H "Authorization: Bearer $CORTEX_TOKEN" $CORTEX_URL/api/v1/items \
  --data-urlencode "q=useEffect" --data-urlencode "type=snippet" --data-urlencode "limit=10"
```

```json
{
  "data": [
    {
      "id": "cm...",
      "title": "Debounced effect",
      "description": null,
      "type": { "id": "cm...", "slug": "snippet", "name": "Snippet", "isSystem": true },
      "content": "useEffect(() => { ...",
      "truncated": true,
      "url": null,
      "language": "typescript",
      "file": null,
      "tags": ["react"],
      "collections": [{ "id": "cm...", "name": "React hooks" }],
      "isFavorite": false,
      "isPinned": false,
      "createdAt": "2026-11-20T09:12:00.000Z",
      "updatedAt": "2026-11-26T17:40:00.000Z"
    }
  ],
  "nextCursor": "eyJ1Ijoi..."
}
```

In a list, `content` holds only the first 300 characters, and `truncated` says whether it was cut.
Get the whole item from `GET /api/v1/items/{id}`. `nextCursor` is `null` on the last page.

### `GET /api/v1/items/{id}` (read)

One item in full: the same fields as in the list, with the whole `content` and no `truncated`
flag. For a file or image item, `file` is `{ "name": "...", "size": 1234 }` (the size is in
bytes). The API does not serve the file itself.

```bash
curl -H "Authorization: Bearer $CORTEX_TOKEN" $CORTEX_URL/api/v1/items/ITEM_ID
```

### `POST /api/v1/items` (write)

Creates a text item or a link and answers `201` with the full item.

| Field | Types | |
| --- | --- | --- |
| `type` | all | `snippet`, `prompt`, `command`, `note`, `link`, or a custom type's slug. |
| `title` | all | Required. |
| `description` | all | Optional. |
| `content` | all but `link` | Optional. |
| `language` | `snippet`, `command`, custom types | Optional. |
| `url` | `link` | Required, `http` or `https`. |
| `tags` | all | Required array of tag names, which can be empty. |
| `collectionIds` | all | Required array of your collection ids, which can be empty. |

A field that the type does not use is ignored. A custom type can also be given as
`"type": "custom"` with its id in `typeId`. `file` and `image` items cannot be created through
the API: they answer `422 unsupported_type`.

```bash
curl -X POST $CORTEX_URL/api/v1/items \
  -H "Authorization: Bearer $CORTEX_TOKEN" -H "Content-Type: application/json" \
  -d '{"type":"command","title":"Prune Docker","content":"docker system prune -af","language":"bash","tags":["docker"],"collectionIds":[]}'
```

### `PATCH /api/v1/items/{id}` (write)

Changes some fields of an item and answers with the full item. Send only the fields to change.
`null` or `""` clears an optional field. `tags` and `collectionIds` replace the whole list when
they are sent. A field that the item's type does not use gives a `422`, for example `url` on a
snippet or `content` on a file.

```bash
curl -X PATCH $CORTEX_URL/api/v1/items/ITEM_ID \
  -H "Authorization: Bearer $CORTEX_TOKEN" -H "Content-Type: application/json" \
  -d '{"title":"Prune Docker (all)","tags":["docker","cleanup"]}'
```

### `GET /api/v1/collections` (read)

All your collections, sorted by name.

```bash
curl -H "Authorization: Bearer $CORTEX_TOKEN" $CORTEX_URL/api/v1/collections
```

```json
{ "data": [{ "id": "cm...", "name": "React hooks", "description": null, "itemCount": 12 }] }
```

### `GET /api/v1/collections/{id}/context` (read)

The collection as a Markdown context file for an AI coding assistant. It is the same file as
**Export context** in the app, served as `text/markdown`. Errors are still JSON.

```bash
curl -H "Authorization: Bearer $CORTEX_TOKEN" \
  $CORTEX_URL/api/v1/collections/COLLECTION_ID/context > CONTEXT.md
```

## Error codes

| Status | Code | When |
| --- | --- | --- |
| 400 | `invalid_json` | The body is not JSON. |
| 401 | `invalid_token` | The token is missing, malformed, unknown, revoked or expired. |
| 403 | `insufficient_scope` | A write with a read-only token. |
| 403 | `pro_required` | A write while the account is not on Pro. |
| 404 | `not_found` | The item or collection does not exist or belongs to someone else. |
| 422 | `invalid_request` | The body or the query is invalid. See `details`. |
| 422 | `unsupported_type` | Creating a `file` or `image` item. |
| 429 | `rate_limited` | Too many requests. Wait for `Retry-After` seconds. |
| 500 | `internal_error` | Something went wrong on our side. |
