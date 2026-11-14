// Checks a pull request title against docs/contributing/pull-requests.md (spec 017, FR-005, US6).
//
//   feat(001): cancel a bill with a reason        OK
//   fixed stuff                                   FAIL  (no type and scope)
//   feat: cancel a bill                           FAIL  (scope missing)
//
// Usage: node scripts/ci/check-pr-title.mjs "feat(001): cancel a bill"   (or set PR_TITLE)
import process from "node:process";
import { pathToFileURL } from "node:url";

export const ALLOWED_TYPES = [
  "feat",
  "fix",
  "refactor",
  "perf",
  "test",
  "docs",
  "build",
  "chore",
  "style",
];
export const MAX_TITLE_LENGTH = 72;

const TITLE_PATTERN = /^(?<type>[a-z]+)\((?<scope>[a-z0-9][a-z0-9-]*)\): (?<summary>.+)$/;

/** Each rule says when the title is broken and why. The first broken rule is reported. */
const TITLE_RULES = [
  {
    isBroken: ({ title }) => title === "",
    describe: () => "The title is empty.",
  },
  {
    isBroken: ({ title }) => title.length > MAX_TITLE_LENGTH,
    describe: ({ title }) =>
      `The title is ${title.length} characters; the limit is ${MAX_TITLE_LENGTH}.`,
  },
  {
    isBroken: ({ match }) => match === null,
    describe: () =>
      "Use the form type(scope): summary, for example feat(001): cancel a bill with a reason.",
  },
  {
    isBroken: ({ match }) => match !== null && !ALLOWED_TYPES.includes(match.groups.type),
    describe: ({ match }) =>
      `Type "${match.groups.type}" is not allowed. Use one of: ${ALLOWED_TYPES.join(", ")}.`,
  },
  {
    isBroken: ({ match }) => match !== null && match.groups.summary.endsWith("."),
    describe: () => "Do not end the summary with a full stop.",
  },
];

/** @returns {{ isValid: boolean, reason: string }} */
export function validatePrTitle(rawTitle) {
  const title = typeof rawTitle === "string" ? rawTitle.trim() : "";
  const context = { title, match: TITLE_PATTERN.exec(title) };
  const brokenRule = TITLE_RULES.find((rule) => rule.isBroken(context));
  return {
    isValid: brokenRule === undefined,
    reason: brokenRule ? brokenRule.describe(context) : "",
  };
}

function runFromCommandLine() {
  const title = process.argv[2] ?? process.env.PR_TITLE ?? "";
  const { isValid, reason } = validatePrTitle(title);
  process.stdout.write(
    isValid ? `PR title OK: ${title}\n` : `PR title rejected: ${reason}\n  Got: "${title}"\n`,
  );
  process.exit(isValid ? 0 : 1);
}

const isRunDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isRunDirectly) runFromCommandLine();
