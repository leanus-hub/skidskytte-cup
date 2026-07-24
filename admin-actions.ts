// Compatibility shim for repositories that previously had this file in the root.
// The real server actions live in app/admin/admin-actions.ts.
export {
  createCup,
  createRace,
  importRaceResults,
  login,
  logout,
  setRaceStatus,
} from './app/admin/admin-actions';
