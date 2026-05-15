export { InlineComments } from "./extension";
export { Comment } from "./comment";
export { CommentReply, SKIP_RESCUE_META } from "./comment-reply";

export {
  createId,
  findComments,
  findReplies,
  locateCommentRanges,
  locateReplyById,
} from "./helpers";

export type { CommentReplyLocation } from "./helpers";
export type {
  CommentAttrs,
  CommentAuthor,
  CommentInfo,
  CommentOptions,
  CommentReplyAttrs,
  CommentReplyOptions,
} from "./types";
