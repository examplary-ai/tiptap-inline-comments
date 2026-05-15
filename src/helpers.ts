import type { Editor } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import { nanoid } from "nanoid";

import { CommentAttrs, CommentInfo, CommentReplyAttrs } from "./types";

export function createId(): string {
  return `cm_${nanoid()}`;
}

export function findComments(source: Editor | PMNode): CommentInfo[] {
  const doc = "state" in source ? source.state.doc : source;

  type Range = {
    id: string;
    from: number;
    to: number;
    text: string;
    attrs: CommentAttrs;
  };

  const rangesById = new Map<string, Range>();

  doc.descendants((node, pos) => {
    const mark = node.marks.find((m) => m.type.name === "comment");
    if (!mark) return;
    const attrs = mark.attrs as CommentAttrs;
    const text = node.isText ? (node.text ?? "") : "";

    const existing = rangesById.get(attrs.id);
    if (existing) {
      existing.to = Math.max(existing.to, pos + node.nodeSize);
      existing.text += text;
      return;
    }
    rangesById.set(attrs.id, {
      id: attrs.id,
      from: pos,
      to: pos + node.nodeSize,
      text,
      attrs: { ...attrs },
    });
  });

  return Array.from(rangesById.values()).map((range) => ({
    ...range.attrs,
    from: range.from,
    to: range.to,
    text: range.text,
  }));
}

export interface CommentReplyLocation {
  attrs: CommentReplyAttrs;
  pos: number;
  nodeSize: number;
}

export function findReplies(
  source: Editor | PMNode,
  commentId: string,
): CommentReplyLocation[] {
  const doc = "state" in source ? source.state.doc : source;
  const replies: CommentReplyLocation[] = [];

  doc.descendants((node, pos) => {
    if (
      node.type.name !== "inline-comment-reply" ||
      node.attrs.commentId !== commentId
    ) {
      return;
    }
    replies.push({
      attrs: node.attrs as CommentReplyAttrs,
      pos,
      nodeSize: node.nodeSize,
    });
  });

  replies.sort(
    (a, b) =>
      new Date(a.attrs?.createdAt || 0).getTime() -
      new Date(b.attrs?.createdAt || 0).getTime(),
  );
  return replies;
}

export function locateReplyById(
  doc: PMNode,
  id: string,
): { pos: number; nodeSize: number } | null {
  let found: { pos: number; nodeSize: number } | null = null;
  doc.descendants((node, pos) => {
    if (found) return false;
    if (node.type.name === "inline-comment-reply" && node.attrs.id === id) {
      found = { pos, nodeSize: node.nodeSize };
      return false;
    }
    return undefined;
  });
  return found;
}

export function locateCommentRanges(doc: PMNode, id: string) {
  const ranges: { from: number; to: number }[] = [];
  doc.descendants((node, pos) => {
    const mark = node.marks.find(
      (m) => m.type.name === "comment" && m.attrs.id === id,
    );
    if (!mark) return;
    ranges.push({ from: pos, to: pos + node.nodeSize });
  });
  ranges.sort((a, b) => a.from - b.from);
  const merged: { from: number; to: number }[] = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && last.to === r.from) last.to = r.to;
    else merged.push({ ...r });
  }
  return merged;
}
