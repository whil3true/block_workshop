import { createEmptyBoard, type BoardState, type CellState } from '../engine';
import { targetCell, type TargetFragment } from './OrderRules';
export interface OrderConfig {
 readonly id: string; readonly chapter: number; readonly contentVersion: number;
 readonly title: { readonly ru: string; readonly en: string };
 readonly board: BoardState; readonly trays: readonly (readonly [string, string, string])[];
 readonly seed: number; readonly fragments: readonly TargetFragment[];
}
function board(fill: (cells: CellState[][]) => void): BoardState {
 const cells = createEmptyBoard().map(row => [...row]); fill(cells); return cells;
}
const fragment = (id: string, coords: readonly (readonly [number, number])[]): TargetFragment => ({
 id, name: { ru: `Фрагмент ${id}`, en: `Fragment ${id}` }, cells: coords.map(([r,c]) => targetCell(r,c)),
});
const recovery = [['single', 'domino-h', 'single'], ['square-2', 'tetra-v', 'single'], ['domino-h', 'tromino-v', 'l2-ne']] as const;
export const CAMPAIGN_CATALOG: readonly OrderConfig[] = [
 { id: 'ch01-order01', chapter: 1, contentVersion: 2, title: { ru: 'Первый фрагмент', en: 'The first fragment' }, seed: 2101,
  board: board(b => { for (let c = 0; c < 4; c++) b[8]![c] = 'line'; }),
  trays: [['tromino-h', 'domino-h', 'single'], ...recovery],
  fragments: [fragment('A', [[8,0],[8,1],[8,2],[8,3]])] },
 { id: 'ch01-order02', chapter: 1, contentVersion: 2, title: { ru: 'Два фрагмента', en: 'Two fragments' }, seed: 2102,
  board: board(b => {
   for (const c of [0,1,2,3,4,8,9]) b[7]![c] = 'line';
   for (const r of [0,1,2,3,5,6,8,9]) b[r]![7] = r < 4 ? 'l2' : 'sq2';
  }),
  trays: [['tromino-h', 'single', 'single'], ...recovery],
  fragments: [fragment('A', [[7,0],[7,1],[7,2],[7,3]]), fragment('B', [[0,7],[1,7],[2,7],[3,7]])] },
 { id: 'ch01-order03', chapter: 1, contentVersion: 2, title: { ru: 'Разделённая мозаика', en: 'A divided mosaic' }, seed: 2103,
  board: board(b => {
   for (const c of [0,1,2,6,7,8,9]) b[4]![c] = c >= 7 ? 'sq2' : 'line';
   for (const r of [0,1,2,3,5,8,9]) b[r]![6] = r < 3 ? 'l2' : 'sq2';
   for (const r of [0,1,2,3,5,6,7,8]) b[r]![0] = r === 5 || r === 6 ? 'line' : 'sq2';
  }),
  trays: [['tromino-h', 'domino-v', 'single'], ['single', 'single', 'domino-h'], ...recovery],
  fragments: [fragment('A', [[4,0],[4,1],[5,0],[6,0]]), fragment('B', [[4,7],[4,8],[4,9]]), fragment('C', [[0,6],[1,6],[2,6]])] },
];
/** Only released content is selectable; future chapters contain no fake order IDs. */
export const CHAPTERS = [
 { number: 1, title: { ru: 'Первые фрагменты', en: 'First fragments' }, orderIds: CAMPAIGN_CATALOG.filter(o => o.chapter === 1).map(o => o.id) },
 { number: 2, title: { ru: 'Мозаика', en: 'Mosaics' }, orderIds: CAMPAIGN_CATALOG.filter(o => o.chapter === 2).map(o => o.id) },
 { number: 3, title: { ru: 'Узоры', en: 'Patterns' }, orderIds: CAMPAIGN_CATALOG.filter(o => o.chapter === 3).map(o => o.id) },
] as const;
export const findOrder = (id: string): OrderConfig | undefined => CAMPAIGN_CATALOG.find(o => o.id === id);
export const isOrderUnlocked = (id: string, completed: readonly string[]): boolean => {
 const index = CAMPAIGN_CATALOG.findIndex(o => o.id === id);
 return index >= 0 && CAMPAIGN_CATALOG.slice(0, index).every(o => completed.includes(o.id));
};
