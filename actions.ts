// Compatibility shim for an obsolete root-level file left in GitHub.
// The real server actions live in app/admin/admin-actions.ts.
export {
  createCup,
  createRace,
  importRaceResults,
  login,
  logout,
  setRaceStatus,
} from './app/admin/admin-actions';
