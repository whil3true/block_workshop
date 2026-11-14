/** Production visual constants from docs/VISUAL_SPEC_V1.md. */
const color = (hex: `#${string}`, alpha = 1) => Object.freeze({
  hex,
  phaser: Number.parseInt(hex.slice(1), 16),
  alpha,
});

export const VISUAL_COLORS = Object.freeze({
  bg: Object.freeze({ app: color("#F6EFE6") }),
  surface: Object.freeze({ elevated: color("#EFE4D6"), card: color("#FFF8F1"), board: color("#FFF8F1") }),
  primary: Object.freeze({
    action: color("#A35F4C"), actionHover: color("#98513F"),
    actionPressed: color("#864534"), actionDisabled: color("#EFE4D6"),
  }),
  text: Object.freeze({ primary: color("#4E4038"), secondary: color("#7A6A60"), tertiary: color("#7A6A60") }),
  accent: Object.freeze({ coral: color("#C96E5B"), gold: color("#B88E4F") }),
  state: Object.freeze({
    success: color("#2D7464"), locked: color("#7C8685"), lockedFill: color("#EFE4D6"),
    selectedFill: color("#D7E8E3"), hint: color("#C98519"), hintFill: color("#F2DDB5"),
    danger: color("#A5423F"), pressedFill: color("#EFE4D6"),
  }),
  // Level Select only: warmer state palette; shared gameplay success/route colors remain untouched.
  levelSelect: Object.freeze({
    completedFill: color("#E8E8D6"), completedCheck: color("#77805A"),
    lockedFill: color("#EEE6D9"), lockedIcon: color("#8C8170"),
    lockedNumber: color("#756C5C"),
  }),
  // Gallery slot treatment only; unavailable, loading, failed and locked states stay distinct.
  gallery: Object.freeze({
    soonFill: color("#FFF8EA"), soonBorder: color("#C5AD8B"),
    soonGlyph: color("#A48A66"), soonLabel: color("#816F57"),
    lockedFill: color("#EEE6D9"), lockedIcon: color("#8C8170"),
  }),
  route: Object.freeze({ core: color("#0B7475"), halo: color("#FFF3D2") }),
  blocker: Object.freeze({ fill: color("#62645E"), dark: color("#3F4543"), relief: color("#ECE4D3") }),
  border: Object.freeze({ strong: color("#C9BEAA"), soft: color("#C9BEAA") }),
  divider: color("#D8C9B7"),
  overlay: Object.freeze({ modal: color("#4E4038", 0.48) }),
  white: color("#FFFFFF"),
  disabledLabel: color("#7A6A60"),
  secondaryHover: color("#EFE4D6"),
  secondaryPressed: color("#D8C9B7"),
});

export const FONT_DISPLAY_FAMILY = 'Nunito, sans-serif';
export const FONT_UI_FAMILY = 'Nunito, sans-serif';

export type TypographyFamilyRole = "display" | "ui";

const typeRole = (
  family: TypographyFamilyRole,
  weight: number,
  size: number,
  lineHeight: number,
  tracking = 0,
  align: "left" | "center" = "left",
) => Object.freeze({ family, weight, size, lineHeight, tracking, align });

export const TYPOGRAPHY = Object.freeze({
  displayBrand: typeRole("ui", 600, 38, 44, -0.4, "center"),
  brandDescriptor: typeRole("ui", 600, 19, 24, 0.1, "center"),
  screenTitle: typeRole("ui", 800, 30, 38, -0.3, "center"),
  chapterHeading: typeRole("ui", 600, 24, 30, -0.2, "center"),
  sectionHeading: typeRole("ui", 600, 22, 28),
  levelTitle: typeRole("ui", 600, 20, 26),
  hudPrimary: typeRole("ui", 800, 25, 30),
  hudSecondary: typeRole("ui", 500, 16, 20),
  buttonPrimary: typeRole("ui", 800, 24, 30, 0, "center"),
  buttonSecondary: typeRole("ui", 700, 22, 28, 0, "center"),
  body: typeRole("ui", 600, 22, 28),
  caption: typeRole("ui", 600, 19, 24, 0.1),
  smallMetadata: typeRole("ui", 500, 14, 18, 0.1),
});
export type TypographyRole = keyof typeof TYPOGRAPHY;

export const SPACING = Object.freeze({
  grid: 8, substep: 4, screenMargin: 24, boardMargin: 16,
  modalWidth: 416, modalMaxWidth: 432, cardPadding: 16,
  modalPaddingHorizontal: 24, modalPaddingVertical: 24,
  buttonPadding: 20, compactButtonPadding: 16, buttonStackGap: 12,
  cardGap: 16, compactCardGap: 12, iconLabelGap: 8,
  minimumTouchTarget: 48, primaryButtonHeight: 56, dominantButtonHeight: 64,
});

export const RADII = Object.freeze({ s: 8, m: 12, l: 16, xl: 20, modal: 24 });
export const COMPONENT_RADII = Object.freeze({
  button: 16, iconButton: 14, tile: 12, levelCard: 16, chapterBanner: 20,
  artwork: 16, modal: 24, boardOuter: 24, boardInner: 16,
});
export const BORDERS = Object.freeze({ divider: 1, structural: 2, emphasized: 3 });
export const SHADOWS = Object.freeze({
  card: Object.freeze({ x: 0, y: 3, blur: 8, color: VISUAL_COLORS.text.primary.phaser, alpha: 0.12 }),
  modal: Object.freeze({ x: 0, y: 10, blur: 28, color: VISUAL_COLORS.text.primary.phaser, alpha: 0.22 }),
  optionalTile: Object.freeze({ x: 0, y: 2, blur: 3, color: VISUAL_COLORS.text.primary.phaser, alpha: 0.18 }),
});

export const MOTION = Object.freeze({
  buttonPressDown: 80, buttonPressUp: 100, tilePress: 80, tileSelection: 120, pairRoute: 280,
  pairRemovalMin: 160, pairRemovalMax: 200, hint: 900,
  artworkRevealMin: 450, artworkRevealMax: 650,
  rewardEntryMin: 280, rewardEntryMax: 360,
  modalEnterMin: 180, modalEnterMax: 220, modalExitMin: 140, modalExitMax: 180,
  chapterNavigationMin: 180, chapterNavigationMax: 240,
  stageLift: 220, stageSettle: 140,
});
