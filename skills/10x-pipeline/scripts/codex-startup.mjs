// Deny list: GitHub token variables never reach a codex child (ADR-017). A new token name is a pattern edit.
const GITHUB_TOKEN_NAME = /^(GH|GITHUB)_([A-Z0-9]+_)*TOKEN$/i;
export function codexChildEnv(env = process.env) {
  return Object.fromEntries(Object.entries(env).filter(([name]) => !GITHUB_TOKEN_NAME.test(name)));
}

export function codexProfileArgs(profile) {
  return profile == null ? [] : ["-p", profile];
}
