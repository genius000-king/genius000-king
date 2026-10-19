// Every collection registers its projects here, in gallery order.
export const P = [];

export const def = (id, name, board, level, tags, summary, build) =>
  P.push({id, name, board, level, tags, summary, build});
