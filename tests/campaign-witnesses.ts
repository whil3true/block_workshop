/** Hand-authored constructive solutions. [tray slot, row, column], zero-based. */
export const WITNESSES = [
 [[0,8,4],[1,8,7],[2,8,9]],
 [[0,7,5],[1,4,7],[2,7,7]],
 [[0,4,3],[1,6,6],[2,9,0],[0,4,0],[1,4,6]],
] as const;
/** Same second order: column first; or both axes/targets cleared in one placement. */
export const COLUMN_FIRST = [[1,4,7],[2,7,7],[0,7,5]] as const;
export const SIMULTANEOUS = [[1,4,7],[0,7,5]] as const;
/** A wasted single, then a complete legal recovery, with no reward or restart. */
export const RECOVERY_PATHS = [
 [[2,0,0],[0,8,4],[1,8,7],[0,8,9]],
 [[2,0,0],[1,4,7],[0,7,5]],
 [[2,9,4],[0,4,3],[1,6,6],[0,4,6],[1,9,0],[2,9,6],[0,4,0]],
] as const;
