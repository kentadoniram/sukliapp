// The version shown at the bottom of Settings. Edit the four values below by hand.
//   major   the current version of the app (12 -> 13 when you start a new version)
//   change  unmerged or new changes since that version (set to 0 after you merge them, add 1 for each new change)
//   base    the default / base build number (keep 1, or the number you use for your default setup)
//   date    the day of this build as MMDD (1021 = 21 October)
export const VERSION = { major: 12, change: 62, base: 1, date: '1025' };
export const versionText = () => `${VERSION.major}.${VERSION.change}.${VERSION.base}.${VERSION.date}`;
