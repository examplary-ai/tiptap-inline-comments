import { Extension } from "@tiptap/core";

import { Comment } from "./comment";
import { CommentReply } from "./comment-reply";
import { CommentOptions } from "./types";

type InlineCommentsOptions = CommentOptions;

declare module "@tiptap/core" {
  interface ExtensionOptions {
    inlineComments: InlineCommentsOptions;
  }
}

export const InlineComments = Extension.create<InlineCommentsOptions>({
  name: "inlineComments",

  addOptions() {
    return {
      createdBy: undefined,
    };
  },

  addExtensions() {
    return [
      Comment.configure(this.options),
      CommentReply.configure(this.options),
    ];
  },
});
