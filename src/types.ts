export type CommentAuthor = {
  id: string;
  name: string;
  color?: string;
};

export interface CommentAttrs {
  id: string;
  createdBy?: CommentAuthor;
  createdAt: string;
  value: string;
}

export interface CommentInfo extends CommentAttrs {
  from: number;
  to: number;
  text: string;
}

export interface CommentOptions {
  createdBy?: CommentAuthor;
}

export interface CommentReplyAttrs {
  id: string;
  commentId: string;
  createdBy?: CommentAuthor;
  createdAt: string;
  value: string;
}

export interface CommentReplyOptions {
  createdBy?: CommentAuthor;
}
