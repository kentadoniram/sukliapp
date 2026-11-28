# Sukli design and quality audit (16.51)

Measured on the 16.50 code, before the 16.51 changes. Numbers come from `tests/ui_test_component_rules.py` and the scripts in this file's history.

## Why the screens still look inconsistently aligned
The design system covers **controls** (buttons, fields, selects, segments, chips, cards) and is enforced by ratchets (0 hand-written buttons, 0 hand-written field labels, 0 raw hex). It does **not** cover **content layout**, which is where you see the drift:

| What | Found | Meaning |
|---|---|---|
| Label-and-figure rows | 5+ separate definitions: `.calfacts li` (73 uses), `.dsrow` (28), `.nrow` (149), `.facts` tiles (21), `.ohr`, `.tokfacts`, `.rowbtn` | Each was written for one screen, with its own padding, alignment and rule. No shared component, so nothing kept them equal. |
| Font sizes | 80 distinct `font-size` values (the scale `--fz-N` has 12 steps) | rem, em, px and tokens are mixed. |
| Padding | 146 distinct `padding` values | No spacing component for content blocks, only for controls. |
| Radii | 110 raw `border-radius` values (45 distinct) | The radius ratchet only checks 10 specific numbers. |
| Inline styles | 126 `style="..."` in `js/*.js` | Colours and sizes set at the call site. |
| Overrides | 59 `!important`; 34 selectors defined in both `styles.css` and `design.css`; 19 "v16.N" override blocks appended to `design.css` | `design.css` loads first, so every fix is written as a stronger override. Layers pile up instead of replacing the old rule. |
| Dead CSS | about 70 class names never mentioned in JS or HTML (some are built dynamically) | Old screens left their styles behind. |

Root cause in one line: **new features were added as new classes and new CSS blocks, not as instances of a shared row/tile/section component, and the guard rails only cover controls.** Alignment follows from that: a row that is its own class decides its own alignment (labels left, figures right in some, centred or left in others). The two concrete bugs found this round were exactly this: `Earned this year / all time` (a new button row with an arrow as a third flex item, so the figure sat in the middle) and `.ohr` rows with no definition at all.

## Has quality degraded?
Yes, in structure rather than in function:
* **Specificity race.** `!important` and "higher specificity than the old rule" are now the normal way to change anything (see `design.css` v16.4x blocks).
* **Duplicated components.** Five row layouts, three tab/segment styles (`.t1seg`, `.segm`, `.wtabs`), two form themes (Theme 1 and legacy) that both need every change.
* **Tests that checked the old shape.** Several UI tests were tied to selectors of replaced controls (`.t1s-slot`, a 16px checkbox). They failed silently when the full run was not repeated: the 16.49 full-suite result was a stale log. Tests now fail loudly, but selectors are still the weak point.
* **Numbers, not just looks.** The 16.50 Prediction bug (huge values) came from a model fed unvalidated input; a quality gap, fixed with input rules and a sanity check.
* No growth problem in speed was found: the performance suite and the 20,000-entry test still pass.

## Recommendations (in order)
1. **One row, one tile, one section component** (done for the row in 16.51: `.kvrow` / `rowHtml()` in `components.js`; the legacy row classes now share its rules). Next: stat tile (`.facts`, `.nwcard`, analytics tiles) and section block.
2. **Retire the old classes screen by screen** instead of overriding them; lower the ratchets each time (new ratchets added in 16.51).
3. **Collapse font sizes to the 12-step scale**: replace rem/em/px values one file section at a time; target under 20 distinct values.
4. **Merge `design.css` and `styles.css` overrides**: when a rule exists in both, keep only the design-layer one.
5. **Drop dead CSS** (the list of about 70 candidates) after checking each is not built dynamically.
6. **Test by role, not by selector**: tests should use `aria-label`/role (as the Investments strip tests now do) so a restyle does not break them.

## Done in 16.51
Alignment of every label-and-figure row (`.calfacts`, `.dsrow`, `.ohr`, `.tokfacts`, `.rowbtn`) set by one rule; ratchets for font-size values, `!important`, inline styles and hand-made rows; `Earned` rows aligned like the rest; the other recommendations are left for you to approve because they touch many screens at once.
