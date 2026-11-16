import type { OrderConfig } from './CampaignCatalog';
import type { BoardState } from '../engine';

/** Authored 10×10 scaffolds: '.' empty, 'x' ordinary mosaic tile. Targets are original row-major addresses. */
const layout = (rows: readonly string[]): BoardState => rows.map(row => [...row].map(c => c === '.' ? null : 'line'));
export const ADDITIONAL_ORDERS: readonly OrderConfig[] = [
 // 4: Two independent ribbons; use a second tray to finish the lower one.
 { id: 'ch01-order04', chapter: 1, contentVersion: 2,
  title: {"ru": "Две ленты", "en": "Twin ribbons"}, seed: 2204,
  board: layout(["..........", "..........", "xxxx.....x", "..........", "..........", "..........", "..........", "x.....xxxx", "..........", ".........."]),
  trays: [["tromino-h", "domino-h", "domino-h"], ["tromino-h", "single", "single"], ["tromino-h", "domino-h", "domino-h"], ["tromino-h", "single", "single"], ["single", "domino-h", "domino-v"], ["single", "single", "single"]],
  fragments: [{"id": "A", "name": {"ru": "Фрагмент A", "en": "Fragment A"}, "cells": [20, 21, 22]}, {"id": "B", "name": {"ru": "Фрагмент B", "en": "Fragment B"}, "cells": [77, 78, 79]}] },
 // 5: Prepare the vertical gap; the shared crossing clears both axes at once.
 { id: 'ch01-order05', chapter: 1, contentVersion: 2,
  title: {"ru": "Перекрёсток", "en": "Crossroads"}, seed: 2205,
  board: layout(["...x......", "..........", "..........", "..........", "...x......", "...x......", "xxx.....xx", "...x......", "...x......", "...x......"]),
  trays: [["tromino-v", "tetra-h", "single"], ["tromino-v", "tetra-h", "single"], ["single", "domino-h", "domino-v"], ["single", "single", "single"]],
  fragments: [{"id": "A", "name": {"ru": "Фрагмент A", "en": "Fragment A"}, "cells": [60, 61, 62]}, {"id": "B", "name": {"ru": "Фрагмент B", "en": "Fragment B"}, "cells": [73, 83, 93]}] },
 // 6: Chapter finale: clearing each rail opens a new hole in the vertical spine.
 { id: 'ch01-order06', chapter: 1, contentVersion: 2,
  title: {"ru": "Рамка мастера", "en": "Apprentice frame"}, seed: 2206,
  board: layout([".....x....", "xx..xxxxxx", ".....x....", "..........", "..........", "..........", ".....x....", "..........", "xxxxxx...x", ".....x...."]),
  trays: [["domino-h", "tromino-h", "tromino-v"], ["single", "single", "single"], ["domino-h", "tromino-h", "tromino-v"], ["single", "single", "single"], ["single", "domino-h", "domino-v"], ["single", "single", "single"]],
  fragments: [{"id": "A", "name": {"ru": "Фрагмент A", "en": "Fragment A"}, "cells": [17, 18, 19]}, {"id": "B", "name": {"ru": "Фрагмент B", "en": "Fragment B"}, "cells": [25, 65, 95]}, {"id": "C", "name": {"ru": "Фрагмент C", "en": "Fragment C"}, "cells": [80, 81, 82]}] },
 // 7: A rectangle clears two rows; repair their two intersections to finish the column.
 { id: 'ch02-order07', chapter: 2, contentVersion: 2,
  title: {"ru": "Парная плитка", "en": "Paired tiles"}, seed: 2207,
  board: layout(["........x.", "........x.", "........x.", "xx...xxxxx", "xx...xxxxx", "........x.", "..........", "..........", "..........", "........x."]),
  trays: [["rect-23-h", "tromino-v", "domino-v"], ["rect-23-h", "tromino-v", "domino-v"], ["single", "domino-h", "domino-v"], ["single", "single", "single"]],
  fragments: [{"id": "A", "name": {"ru": "Фрагмент A", "en": "Fragment A"}, "cells": [30, 31, 40, 41]}, {"id": "B", "name": {"ru": "Фрагмент B", "en": "Fragment B"}, "cells": [8, 18, 28]}] },
 // 8: Split a tall rectangular opening between a square and a domino; save the last column for tray two.
 { id: 'ch02-order08', chapter: 2, contentVersion: 2,
  title: {"ru": "Высокие окна", "en": "Tall windows"}, seed: 2208,
  board: layout(["..xx...x..", "..xx...x..", ".......x..", ".......x..", ".......x..", "..xx......", "..xx......", "..xx......", "..xx......", "..xx......"]),
  trays: [["square-2", "domino-h", "tromino-v"], ["domino-v", "single", "single"], ["square-2", "domino-h", "tromino-v"], ["domino-v", "single", "single"], ["single", "domino-h", "domino-v"], ["single", "single", "single"]],
  fragments: [{"id": "A", "name": {"ru": "Фрагмент A", "en": "Fragment A"}, "cells": [62, 63, 72, 73, 82, 83]}, {"id": "B", "name": {"ru": "Фрагмент B", "en": "Fragment B"}, "cells": [7, 17, 27, 37]}] },
 // 9: Offset gaps require interlocking Z and corner pieces; three stair treads clear separately.
 { id: 'ch02-order09', chapter: 2, contentVersion: 2,
  title: {"ru": "Лестница", "en": "Stairway"}, seed: 2209,
  board: layout(["..........", "..........", "xxx...xxxx", "xxxx....xx", "xxxxx...xx", "..........", "..........", "..........", "..........", ".........."]),
  trays: [["tetro-z-0", "l2-sw", "single"], ["domino-h", "single", "single"], ["tetro-z-0", "l2-sw", "single"], ["domino-h", "single", "single"], ["single", "domino-h", "domino-v"], ["single", "single", "single"]],
  fragments: [{"id": "A", "name": {"ru": "Фрагмент A", "en": "Fragment A"}, "cells": [20, 21, 22]}, {"id": "B", "name": {"ru": "Фрагмент B", "en": "Fragment B"}, "cells": [38, 39]}, {"id": "C", "name": {"ru": "Фрагмент C", "en": "Fragment C"}, "cells": [40, 41, 42, 43]}] },
 // 10: Four rails share corners. Clear horizontal rails first; reserve singles to repair both verticals.
 { id: 'ch02-order10', chapter: 2, contentVersion: 2,
  title: {"ru": "Двойной переплёт", "en": "Double binding"}, seed: 2210,
  board: layout(["..x....x..", "..x....x..", "xxxx..xxxx", "..x....x..", "..........", "..........", "..x....x..", "xxxx..xxxx", "..x....x..", "..x....x.."]),
  trays: [["domino-h", "domino-v", "domino-h"], ["domino-v", "single", "single"], ["single", "single", "single"], ["domino-h", "domino-v", "domino-h"], ["domino-v", "single", "single"], ["single", "single", "single"], ["single", "domino-h", "domino-v"], ["single", "single", "single"]],
  fragments: [{"id": "A", "name": {"ru": "Фрагмент A", "en": "Fragment A"}, "cells": [20, 21, 2, 12]}, {"id": "B", "name": {"ru": "Фрагмент B", "en": "Fragment B"}, "cells": [78, 79, 87, 97]}] },
 // 11: Broad openings: allocate six pieces across two trays without crowding the next row.
 { id: 'ch02-order11', chapter: 2, contentVersion: 2,
  title: {"ru": "Три ступени", "en": "Three steps"}, seed: 2211,
  board: layout(["..........", "x......xxx", "..........", "..........", "xx......xx", "..........", "..........", "xxx......x", "..........", ".........."]),
  trays: [["tetra-h", "domino-h", "tromino-h"], ["tromino-h", "penta-h", "single"], ["tetra-h", "domino-h", "tromino-h"], ["tromino-h", "penta-h", "single"], ["single", "domino-h", "domino-v"], ["single", "single", "single"]],
  fragments: [{"id": "A", "name": {"ru": "Фрагмент A", "en": "Fragment A"}, "cells": [17, 18, 19]}, {"id": "B", "name": {"ru": "Фрагмент B", "en": "Fragment B"}, "cells": [40, 41, 48, 49]}, {"id": "C", "name": {"ru": "Фрагмент C", "en": "Fragment C"}, "cells": [70, 71, 72]}] },
 // 12: Chapter finale: a double rail, lower rail and two uprights; two stages of intersection repair.
 { id: 'ch02-order12', chapter: 2, contentVersion: 2,
  title: {"ru": "Витраж", "en": "Stained glass"}, seed: 2212,
  board: layout(["..x....x..", "..x....x..", "xxxx...xxx", "xxxx...xxx", "..........", "..........", "..........", "xxxx...xxx", "..x....x..", "..x....x.."]),
  trays: [["rect-23-h", "tromino-h", "tromino-v"], ["tromino-v", "domino-v", "single"], ["domino-v", "single", "single"], ["rect-23-h", "tromino-h", "tromino-v"], ["tromino-v", "domino-v", "single"], ["domino-v", "single", "single"], ["single", "domino-h", "domino-v"], ["single", "single", "single"]],
  fragments: [{"id": "A", "name": {"ru": "Фрагмент A", "en": "Fragment A"}, "cells": [20, 21, 30, 31]}, {"id": "B", "name": {"ru": "Фрагмент B", "en": "Fragment B"}, "cells": [7, 17]}, {"id": "C", "name": {"ru": "Фрагмент C", "en": "Fragment C"}, "cells": [78, 79, 87, 97]}] },
 // 13: Two recognizable L fragments; match opposing corner openings. A short visual breather after chapter two.
 { id: 'ch03-order13', chapter: 3, contentVersion: 2,
  title: {"ru": "Уголки", "en": "Corner inlays"}, seed: 2213,
  board: layout(["..........", "..........", "xxxx..xxxx", "xxxx..xxxx", "..........", "..........", "xx...xxxxx", "xx.xxxxxxx", "..........", ".........."]),
  trays: [["l2-ne", "single", "l2-se"], ["single", "single", "single"], ["l2-ne", "single", "l2-se"], ["single", "single", "single"], ["single", "domino-h", "domino-v"], ["single", "single", "single"]],
  fragments: [{"id": "A", "name": {"ru": "Фрагмент A", "en": "Fragment A"}, "cells": [20, 30, 31]}, {"id": "B", "name": {"ru": "Фрагмент B", "en": "Fragment B"}, "cells": [68, 69, 79]}] },
 // 14: A T prepares the stem; the bridge domino clears the outer leaves before the middle row.
 { id: 'ch03-order14', chapter: 3, contentVersion: 2,
  title: {"ru": "Трилистник", "en": "Trefoil"}, seed: 2214,
  board: layout(["..........", "..........", "xxxx..xxxx", "xxxx.....x", "xxxx..xxxx", "..........", "..........", "..........", "..........", ".........."]),
  trays: [["tetro-t-right", "single", "tromino-h"], ["single", "single", "single"], ["tetro-t-right", "single", "tromino-h"], ["single", "single", "single"], ["single", "domino-h", "domino-v"], ["single", "single", "single"]],
  fragments: [{"id": "A", "name": {"ru": "Фрагмент A", "en": "Fragment A"}, "cells": [20, 30, 40, 41, 42]}, {"id": "B", "name": {"ru": "Фрагмент B", "en": "Fragment B"}, "cells": [27, 28, 29, 47, 48, 49]}] },
 // 15: A rectangular opening is woven from two opposite Ls; three rails then open a split spine repair.
 { id: 'ch03-order15', chapter: 3, contentVersion: 2,
  title: {"ru": "Спираль", "en": "Spiral"}, seed: 2215,
  board: layout(["........x.", "xxxx...xxx", "xxxx...xxx", "........x.", "..........", "..........", "..........", "xx....xxxx", "........x.", "........x."]),
  trays: [["l2-se", "l2-nw", "tetra-h"], ["tromino-v", "domino-v", "single"], ["l2-se", "l2-nw", "tetra-h"], ["tromino-v", "domino-v", "single"], ["single", "domino-h", "domino-v"], ["single", "single", "single"]],
  fragments: [{"id": "A", "name": {"ru": "Фрагмент A", "en": "Fragment A"}, "cells": [10, 20, 21]}, {"id": "B", "name": {"ru": "Фрагмент B", "en": "Fragment B"}, "cells": [77, 78, 88, 98]}] },
 // 16: Two bands, four rows. Pair squares above and combine rectangle plus square below; each clear removes a whole fragment.
 { id: 'ch03-order16', chapter: 3, contentVersion: 2,
  title: {"ru": "Шахматная кайма", "en": "Woven border"}, seed: 2216,
  board: layout(["..........", "..........", "xxx....xxx", "xxx....xxx", "..........", "..........", "xx.....xxx", "xx.....xxx", "..........", ".........."]),
  trays: [["square-2", "square-2", "rect-23-h"], ["square-2", "single", "single"], ["square-2", "square-2", "rect-23-h"], ["square-2", "single", "single"], ["single", "domino-h", "domino-v"], ["single", "single", "single"]],
  fragments: [{"id": "A", "name": {"ru": "Фрагмент A", "en": "Fragment A"}, "cells": [20, 21, 30, 31]}, {"id": "B", "name": {"ru": "Фрагмент B", "en": "Fragment B"}, "cells": [68, 69, 78, 79]}] },
 // 17: Two crossing bands: repairing the second horizontal crossing clears both uprights in one move.
 { id: 'ch03-order17', chapter: 3, contentVersion: 2,
  title: {"ru": "Плетение", "en": "Interlace"}, seed: 2217,
  board: layout(["...xx.....", "...xx.....", "xxxxxx...x", "...xx.....", "..........", "..........", "...xx.....", "...xxxxxxx", "...xx.....", "...xx....."]),
  trays: [["tromino-h", "square-2", "tromino-h"], ["domino-h", "domino-h", "single"], ["tromino-h", "square-2", "tromino-h"], ["domino-h", "domino-h", "single"], ["single", "domino-h", "domino-v"], ["single", "single", "single"]],
  fragments: [{"id": "A", "name": {"ru": "Фрагмент A", "en": "Fragment A"}, "cells": [20, 21, 22, 33, 34]}, {"id": "B", "name": {"ru": "Фрагмент B", "en": "Fragment B"}, "cells": [77, 78, 79, 63, 64]}] },
 // 18: Final seal: clear two paired bands, then rebuild four double intersections to remove the opposing Ls and corner seals.
 { id: 'ch03-order18', chapter: 3, contentVersion: 2,
  title: {"ru": "Печать мастерской", "en": "Workshop seal"}, seed: 2218,
  board: layout([".x......x.", "xxx...xxxx", "xxx...xxxx", "..........", "..........", "..........", "..........", "xxxx...xxx", "xxxx...xxx", ".x......x."]),
  trays: [["rect-23-h", "rect-23-h", "tetra-v"], ["tetra-v", "domino-v", "domino-v"], ["domino-v", "domino-v", "single"], ["rect-23-h", "rect-23-h", "tetra-v"], ["tetra-v", "domino-v", "domino-v"], ["domino-v", "domino-v", "single"], ["single", "domino-h", "domino-v"], ["single", "single", "single"]],
  fragments: [{"id": "A", "name": {"ru": "Фрагмент A", "en": "Fragment A"}, "cells": [1, 11, 21, 20]}, {"id": "B", "name": {"ru": "Фрагмент B", "en": "Fragment B"}, "cells": [98, 88, 78, 79]}, {"id": "C", "name": {"ru": "Фрагмент C", "en": "Fragment C"}, "cells": [8, 91]}] },
];
