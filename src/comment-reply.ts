import { Node } from "@tiptap/core";
import { Plugin, PluginKey, TextSelection } from "@tiptap/pm/state";

import {
  createId,
  findReplies,
  locateCommentRanges,
  locateReplyById,
} from "./helpers";
import { CommentReplyAttrs, CommentReplyOptions } from "./types";

export const SKIP_RESCUE_META = "comment-reply:intentional-delete";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    "inline-comment-reply": {
      addCommentReply: (params: {
        commentId: string;
        value?: string;
      }) => ReturnType;
      updateCommentReply: (params: { id: string; value: string }) => ReturnType;
      removeCommentReply: (params: { id: string }) => ReturnType;
    };
  }
}

export const CommentReply = Node.create<CommentReplyOptions>({
  name: "inline-comment-reply",
  inline: true,
  group: "inline",
  atom: true,
  selectable: false,
  draggable: false,

  addOptions() {
    return { createdBy: undefined };
  },

  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: (el) => el.getAttribute("id"),
        renderHTML: (attrs: Partial<CommentReplyAttrs>) => ({
          id: attrs.id ?? createId(),
        }),
      },
      commentId: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-comment-id"),
        renderHTML: (attrs: Partial<CommentReplyAttrs>) => ({
          "data-comment-id": attrs.commentId,
        }),
      },
      createdAt: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-created-at"),
        renderHTML: (attrs: Partial<CommentReplyAttrs>) => ({
          "data-created-at": attrs.createdAt,
        }),
      },
      createdBy: {
        default: null,
        parseHTML: (el) => ({
          id: el.getAttribute("data-user-id")!,
          name: el.getAttribute("data-user-name")!,
          color: el.getAttribute("data-user-color"),
        }),
        renderHTML: (attrs: Partial<CommentReplyAttrs>) => ({
          "data-user-id": attrs.createdBy?.id,
          "data-user-name": attrs.createdBy?.name,
          "data-user-color": attrs.createdBy?.color,
        }),
      },
      value: {
        default: "",
        parseHTML: (el) => el.getAttribute("value") ?? "",
        renderHTML: (attrs: Partial<CommentReplyAttrs>) => ({
          value: attrs.value ?? "",
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "inline-comment-reply" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["inline-comment-reply", HTMLAttributes];
  },

  addCommands() {
    return {
      addCommentReply:
        ({ commentId, value }) =>
        ({ state, tr, dispatch }) => {
          const nodeType = state.schema.nodes["inline-comment-reply"];
          if (!nodeType) return false;

          const ranges = locateCommentRanges(state.doc, commentId);
          if (ranges.length === 0) return false;
          if (!dispatch) return true;

          const existing = findReplies(state.doc, commentId);
          const last = existing[existing.length - 1];
          const insertAt = last ? last.pos + last.nodeSize : ranges[0]!.from;

          const node = nodeType.create({
            id: createId(),
            commentId,
            createdBy: this.options.createdBy,
            createdAt: new Date().toISOString(),
            value: value ?? "",
          });
          tr.insert(insertAt, node);
          dispatch(tr);
          return true;
        },

      updateCommentReply:
        ({ id, value }) =>
        ({ state, tr, dispatch }) => {
          const nodeType = state.schema.nodes["inline-comment-reply"];
          if (!nodeType) return false;

          const located = locateReplyById(state.doc, id);
          if (!located) return false;
          if (!dispatch) return true;

          const existing = state.doc.nodeAt(located.pos);
          if (!existing) return false;

          tr.setNodeMarkup(located.pos, undefined, {
            ...existing.attrs,
            value,
          });
          dispatch(tr);
          return true;
        },

      removeCommentReply:
        ({ id }) =>
        ({ state, tr, dispatch }) => {
          const located = locateReplyById(state.doc, id);
          if (!located) return false;
          if (!dispatch) return true;

          tr.setMeta(SKIP_RESCUE_META, true);
          tr.delete(located.pos, located.pos + located.nodeSize);
          dispatch(tr);
          return true;
        },
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("rescueCommentReplies"),
        props: {
          handleKeyDown(view, event) {
            if (event.key !== "Backspace" && event.key !== "Delete") {
              return false;
            }
            const { selection } = view.state;
            if (!selection.empty) return false;

            const $pos = view.state.doc.resolve(selection.from);
            const node =
              event.key === "Backspace" ? $pos.nodeBefore : $pos.nodeAfter;
            if (node?.type.name !== "inline-comment-reply") return false;

            const newPos =
              event.key === "Backspace"
                ? selection.from - node.nodeSize
                : selection.from + node.nodeSize;

            view.dispatch(
              view.state.tr.setSelection(
                TextSelection.create(view.state.doc, newPos),
              ),
            );
            return true;
          },
        },
        appendTransaction: (transactions, oldState, newState) => {
          if (!transactions.some((t) => t.docChanged)) return null;
          if (transactions.some((t) => t.getMeta(SKIP_RESCUE_META))) {
            return null;
          }
          if (transactions.some((t) => t.getMeta("addToHistory") === false)) {
            return null;
          }

          const nodeType = newState.schema.nodes["inline-comment-reply"];
          if (!nodeType) return null;

          const oldReplies: { id: string; attrs: CommentReplyAttrs }[] = [];
          oldState.doc.descendants((node) => {
            if (node.type === nodeType) {
              oldReplies.push({
                id: node.attrs.id,
                attrs: node.attrs as CommentReplyAttrs,
              });
            }
          });
          if (oldReplies.length === 0) return null;

          const surviving = new Set<string>();
          newState.doc.descendants((node) => {
            if (node.type === nodeType) surviving.add(node.attrs.id);
          });

          const missing = oldReplies.filter((r) => !surviving.has(r.id));
          if (missing.length === 0) return null;

          const tr = newState.tr;
          tr.setMeta("addToHistory", false);
          let didChange = false;

          for (const reply of missing) {
            const commentId = reply.attrs.commentId;
            if (!commentId) continue;

            const ranges = locateCommentRanges(tr.doc, commentId);
            if (ranges.length === 0) continue;

            const existing = findReplies(tr.doc, commentId);
            const last = existing[existing.length - 1];
            const insertAt = last ? last.pos + last.nodeSize : ranges[0]!.from;

            tr.insert(insertAt, nodeType.create(reply.attrs));
            didChange = true;
          }

          return didChange ? tr : null;
        },
      }),
    ];
  },
});
