import { Mark } from "@tiptap/core";

import { SKIP_RESCUE_META } from "./comment-reply";
import { createId, findReplies, locateCommentRanges } from "./helpers";
import { CommentAttrs, CommentOptions } from "./types";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    comment: {
      toggleComment: () => ReturnType;
      addComment: (params: {
        from: number;
        to: number;
        value?: string;
      }) => ReturnType;
      updateComment: (params: { id: string; value: string }) => ReturnType;
      removeComment: (params: { id: string }) => ReturnType;
    };
  }
}

export const Comment = Mark.create<CommentOptions>({
  name: "comment",

  inclusive: false,
  spanning: true,
  keepOnSplit: true,
  excludes: "",

  addOptions() {
    return { createdBy: undefined };
  },

  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: (el) => el.getAttribute("id"),
        renderHTML: (attrs: Partial<CommentAttrs>) => ({
          id: attrs.id ?? createId(),
        }),
      },
      createdAt: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-created-at"),
        renderHTML: (attrs: Partial<CommentAttrs>) => ({
          "data-created-at": attrs.createdAt,
        }),
      },
      createdBy: {
        default: null,
        parseHTML: (el) => {
          return {
            id: el.getAttribute("data-user-id")!,
            name: el.getAttribute("data-user-name")!,
            color: el.getAttribute("data-user-color"),
          };
        },
        renderHTML: (attrs: Partial<CommentAttrs>) => ({
          "data-user-id": attrs.createdBy?.id,
          "data-user-name": attrs.createdBy?.name,
          "data-user-color": attrs.createdBy?.color,
        }),
      },
      value: {
        default: "",
        parseHTML: (el) => el.getAttribute("value") ?? "",
        renderHTML: (attrs: Partial<CommentAttrs>) => ({
          value: attrs.value ?? "",
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "inline-comment" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "inline-comment",
      {
        ...HTMLAttributes,
        style: `--comment-color: ${HTMLAttributes["data-user-color"]}`,
      },
      0,
    ];
  },

  addCommands() {
    return {
      addComment:
        ({ from, to, value }) =>
        ({ state, tr, dispatch }) => {
          if (to <= from) return false;
          const markType = state.schema.marks.comment;
          if (!markType) return false;
          if (!dispatch) return true;

          const attrs: CommentAttrs = {
            id: createId(),
            createdBy: this.options.createdBy,
            value: value ?? "",
            createdAt: new Date().toISOString(),
          };
          tr.addMark(from, to, markType.create(attrs));
          dispatch(tr);
          return true;
        },

      toggleComment:
        () =>
        ({ state, tr, dispatch }) => {
          const markType = state.schema.marks.comment;
          if (!markType || !dispatch) return false;

          // Find if there's a comment mark at the current selection
          const { from, to } = state.selection;
          const commentMarks = state.doc.rangeHasMark(from, to, markType);
          if (commentMarks) {
            return true;
          }

          // Otherwise, add a new comment mark with empty body at the current selection
          const attrs: CommentAttrs = {
            id: createId(),
            createdBy: this.options.createdBy,
            value: "",
            createdAt: new Date().toISOString(),
          };
          tr.addMark(from, to, markType.create(attrs));
          dispatch(tr);
          return true;
        },

      updateComment:
        ({ id, value }) =>
        ({ state, tr, dispatch }) => {
          const markType = state.schema.marks.comment;
          if (!markType) return false;

          const ranges = locateCommentRanges(state.doc, id);
          if (ranges.length === 0) return false;
          if (!dispatch) return true;

          const existing = state.doc
            .resolve(ranges[0]!.from + 1)
            .marks()
            .find((m) => m.type === markType && m.attrs.id === id);
          if (!existing) return false;

          const next = markType.create({ ...existing.attrs, value });
          for (const r of [...ranges].sort((a, b) => b.from - a.from)) {
            tr.removeMark(r.from, r.to, markType);
            tr.addMark(r.from, r.to, next);
          }
          dispatch(tr);
          return true;
        },

      removeComment:
        ({ id }) =>
        ({ state, tr, dispatch }) => {
          const markType = state.schema.marks.comment;
          if (!markType) return false;

          const ranges = locateCommentRanges(state.doc, id);
          if (ranges.length === 0) return false;
          if (!dispatch) return true;

          for (const r of [...ranges].sort((a, b) => b.from - a.from)) {
            tr.removeMark(r.from, r.to, markType);
          }

          const replies = [...findReplies(state.doc, id)].sort(
            (a, b) => b.pos - a.pos,
          );
          for (const r of replies) {
            tr.delete(r.pos, r.pos + r.nodeSize);
          }

          tr.setMeta(SKIP_RESCUE_META, true);
          dispatch(tr);
          return true;
        },
    };
  },
});
