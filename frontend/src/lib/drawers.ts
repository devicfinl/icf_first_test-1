// App-wide drawers opened from anywhere through the URL (?drawer=…), so a link in the sidebar or
// a button on any page opens them over the current page, and Back closes them.
export const DRAWER_PARAM = "drawer";
export const CHANGE_PASSWORD_DRAWER = "change-password";

/** The current URL with a drawer open, e.g. for <Link to={…}> or navigate(…). */
export function withDrawer(location: { pathname: string; search: string }, drawer: string) {
  const params = new URLSearchParams(location.search);
  params.set(DRAWER_PARAM, drawer);
  return `${location.pathname}?${params.toString()}`;
}
