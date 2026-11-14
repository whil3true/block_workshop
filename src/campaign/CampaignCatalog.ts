import { createEmptyBoard, type BoardState, type CellState } from '../engine';
import type { Operation } from './OrderRules';
export interface OrderConfig {
 readonly id: string; readonly chapter: number; readonly contentVersion: number;
 readonly title: { readonly ru: string; readonly en: string };
 readonly board: BoardState; readonly trays: readonly (readonly [string, string, string])[];
 readonly seed: number; readonly operations: readonly Operation[];
}
function board(fill: (cells: CellState[][]) => void): BoardState {
 const cells = createEmptyBoard().map(row => [...row]); fill(cells); return cells;
}
const recovery = [['tromino-h', 'domino-v', 'single'], ['square-2', 'tetra-v', 'single'], ['domino-h', 'tromino-v', 'l2-ne']] as const;
export const CAMPAIGN_CATALOG: readonly OrderConfig[] = [
 { id: 'ch01-order01', chapter: 1, contentVersion: 1, title: { ru: 'Первая полоска', en: 'The first strip' }, seed: 1101,
  board: board(b => { for (let c = 0; c < 4; c++) b[8]![c] = 'line'; b[3]![2] = 'sq2'; b[3]![3] = 'sq2'; b[4]![2] = 'sq2'; b[4]![3] = 'sq2'; }),
  trays: [['tromino-h', 'domino-h', 'single'], ...recovery], operations: [{ kind: 'lines', axis: 'row', count: 1 }] },
 { id: 'ch01-order02', chapter: 1, contentVersion: 1, title: { ru: 'Смена направления', en: 'A change of direction' }, seed: 1102,
  board: board(b => { for (let c = 0; c < 5; c++) b[7]![c] = 'line'; for (let r = 0; r < 10; r++) if (r !== 4) b[r]![2] = 'l2'; }),
  trays: [['penta-h', 'single', 'single'], ...recovery], operations: [{ kind: 'lines', axis: 'row', count: 1 }, { kind: 'lines', axis: 'column', count: 1 }] },
 { id: 'ch01-order03', chapter: 1, contentVersion: 1, title: { ru: 'Точный узор', en: 'A precise pattern' }, seed: 1103,
  board: board(b => { for (const c of [0,1,2,6,7,8]) b[4]![c] = 'sq2'; for (const r of [0,1,2,3,4,5,8,9]) b[r]![6] = 'l2'; }),
  trays: [['tromino-h', 'domino-v', 'single'], ['single', 'square-2', 'domino-h'], ...recovery],
  operations: [{ kind: 'targetLine', axis: 'row', index: 4 }, { kind: 'targetLine', axis: 'column', index: 6 }] },
];
/** Only released content is selectable; future chapters contain no fake order IDs. */
export const CHAPTERS = [
 { number: 1, title: { ru: 'Первые линии', en: 'First lines' }, orderIds: CAMPAIGN_CATALOG.filter(o => o.chapter === 1).map(o => o.id) },
 { number: 2, title: { ru: 'Порядок мозаики', en: 'Mosaic sequence' }, orderIds: CAMPAIGN_CATALOG.filter(o => o.chapter === 2).map(o => o.id) },
 { number: 3, title: { ru: 'Точные линии', en: 'Precise lines' }, orderIds: CAMPAIGN_CATALOG.filter(o => o.chapter === 3).map(o => o.id) },
] as const;
export const findOrder = (id: string): OrderConfig | undefined => CAMPAIGN_CATALOG.find(o => o.id === id);
export const isOrderUnlocked = (id: string, completed: readonly string[]): boolean => {
 const index = CAMPAIGN_CATALOG.findIndex(o => o.id === id);
 return index >= 0 && CAMPAIGN_CATALOG.slice(0, index).every(o => completed.includes(o.id));
};
