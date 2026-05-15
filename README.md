# tiptap-inline-comments

Tiptap extensions that add inline comments and threaded replies to any [Tiptap](https://tiptap.dev) editor.

Comments and replies are stored as inline nodes inside the document, so the comment thread travels with the content and serializes cleanly to HTML.

## Installation

```bash
yarn add tiptap-inline-comments
```

Peer dependencies: `@tiptap/core` and `@tiptap/pm` (Tiptap v3+).

## Usage

The simplest setup is the bundled `InlineComments` extension:

```ts
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { InlineComments } from "tiptap-inline-comments";

const editor = new Editor({
  extensions: [
    StarterKit,
    InlineComments.configure({
      createdBy: {
        id: "user_123",
        name: "Ada Lovelace",
        color: "#ff8a65",
      },
    }),
  ],
});
```

`createdBy` is stamped onto new comments and replies. Omit it if you don't have an author context.

If you want finer-grained control, register the two extensions yourself:

```ts
import { Comment, CommentReply } from "tiptap-inline-comments";

new Editor({
  extensions: [
    Comment.configure({ createdBy }),
    CommentReply.configure({ createdBy }),
  ],
});
```

## Commands

`Comment` adds the following commands to the editor:

| Command                            | Description                                                        |
| ---------------------------------- | ------------------------------------------------------------------ |
| `addComment({ from, to, value? })` | Wrap a range in a comment mark.                                    |
| `toggleComment()`                  | Add a comment on the current selection if there isn't one already. |
| `updateComment({ id, value })`     | Replace the body of an existing comment.                           |
| `removeComment({ id })`            | Remove the comment mark and delete its replies.                    |

`CommentReply` adds:

| Command                                  | Description                         |
| ---------------------------------------- | ----------------------------------- |
| `addCommentReply({ commentId, value? })` | Append a reply to a comment thread. |
| `updateCommentReply({ id, value })`      | Replace the body of a reply.        |
| `removeCommentReply({ id })`             | Delete a reply.                     |

Example:

```ts
editor
  .chain()
  .focus()
  .addComment({ from: 10, to: 24, value: "Reword this?" })
  .run();

editor
  .chain()
  .focus()
  .addCommentReply({ commentId: "cm_abc123", value: "Agreed, done." })
  .run();
```

## Reading comment state

The package exports a few helpers for inspecting the document:

```ts
import { findComments, findReplies } from "tiptap-inline-comments";

const comments = findComments(editor); // CommentInfo[]
const replies = findReplies(editor, comments[0].id);
```

`findComments` returns one entry per comment id with its merged `{ from, to, text }` range, even if the mark has been split across multiple text nodes.
`findReplies` returns replies sorted by `createdAt`.

Lower-level position helpers are also exposed:

```ts
import { locateCommentRanges, locateReplyById } from "tiptap-inline-comments";

const ranges = locateCommentRanges(editor.state.doc, "cm_abc123");
const reply = locateReplyById(editor.state.doc, "cm_xyz789");
```

## HTML output

Comments and replies serialize to custom elements so you can render them however you like outside the editor:

```html
<p>
  The quick
  <inline-comment
    id="cm_abc123"
    data-created-at="2025-01-01T00:00:00.000Z"
    data-user-id="user_123"
    data-user-name="Ada Lovelace"
    data-user-color="#ff8a65"
    value="Reword this?"
    style="--comment-color: #ff8a65"
    >brown fox</inline-comment
  >
  jumps over the lazy dog.
  <inline-comment-reply
    id="cm_xyz789"
    data-comment-id="cm_abc123"
    data-created-at="2025-01-01T00:01:00.000Z"
    data-user-id="user_456"
    data-user-name="Grace Hopper"
    value="Agreed, done."
  ></inline-comment-reply>
</p>
```

Both elements round-trip through `parseHTML`, so the same content can be loaded back into the editor without losing thread state.

## Styling

Within the editor, you might want to add some custom HTML to make comments visible:

```css
inline-comment {
  --comment-color: #ff8a65; /* fallback if not set inline */

  background-color: color-mix(in srgb, var(--comment-color) 25%, transparent);
  border-bottom: 2px solid
    color-mix(in srgb, var(--comment-color) 75%, transparent);
}
```
