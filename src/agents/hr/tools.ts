import type { JsonObject, JsonValue } from "../../llm/client.js";
import type { ScopedTool } from "../specialist-agent.js";
import {
  attritionFor,
  headcountFor,
  HR_DATASET,
  PERIODS,
  TEAMS,
  type Employee,
  type Period,
  type Team,
} from "./dataset.js";

/**
 * The HR Agent's Scoped Tools: the only path by which it reads anything.
 *
 * Four read-only lookups over the HR Dataset — headcount, vacancies, attrition,
 * and individual salaries. Each returns rows of the Dataset as they stand, so
 * every figure an answer can be built from is a figure someone can find in
 * `dataset.json`. Nothing here computes, and nothing here reaches outside this
 * one Dataset.
 *
 * These functions are exposed to exactly one agent (ADR 0004). Reusing one from
 * the Finance Agent would not be a shortcut, it would be the end of the
 * guarantee.
 *
 * The salary tool is the one place in the system where an individual's pay can
 * be read at all. That it lives here, in the HR Agent's tool set and nowhere
 * else, is the whole content of "a finance Question can never surface a
 * salary": there is no second copy to reach.
 */

/** The date the whole Dataset is as of, carried on each result so a figure is never bare. */
const { asOf, currency } = HR_DATASET;

/**
 * A tool result: Dataset rows, stamped with the date they are as of, and frozen.
 *
 * Frozen for the same reason the Dataset is. A tool result is evidence the
 * Number Audit will check an answer against, and evidence that could be edited
 * on the way to the audit is not evidence.
 *
 * The date is stamped on every result because every figure here is as of a
 * date; the currency is not, because only one of these results has money in it.
 * The Finance Dataset stamps currency on everything for the same reason in
 * reverse — there, every figure is money. A currency on a headcount would say
 * this agent deals in company money, and it does not.
 */
const result = <T extends object>(fields: T): JsonValue =>
  Object.freeze({ asOf, ...fields }) as JsonValue;

/**
 * The answers to inputs this Dataset cannot serve.
 *
 * Constants built from the Dataset's own vocabulary, so the model's words
 * cannot travel into a tool result. A tool result is what the Number Audit
 * checks an answer's figures against; text that came from the model rather than
 * the Dataset has no business arriving there dressed as evidence.
 */
const NO_SUCH_TEAM: JsonObject = Object.freeze({
  error: `No such team. The teams are: ${TEAMS.join(", ")}.`,
});

const NO_SUCH_PERIOD: JsonObject = Object.freeze({
  error: `No figures for that period. Ask for one of: ${PERIODS.join(", ")}.`,
});

const NO_ONE_NAMED: JsonObject = Object.freeze({
  error:
    "Nobody on the roster matches that. Check the spelling of the name, or ask by role or by " +
    "team instead.",
});

const ASK_FOR_SOMEONE: JsonObject = Object.freeze({
  error:
    "Say who to look up: a name, a role, or a team. This tool reports the pay of the people " +
    "you ask for, not the roster in bulk.",
});

const teamIn = (input: JsonObject): Team | undefined =>
  TEAMS.find((known) => known === input["team"]);

const periodIn = (input: JsonObject): Period | undefined =>
  PERIODS.find((known) => known === input["period"]);

/** A tool parameter naming one of the teams. Optional where a whole-company view makes sense. */
const teamParameter = (what: string): JsonObject => ({
  team: {
    type: "string",
    enum: [...TEAMS],
    description: `Which team to report ${what} for. Omit for the whole company.`,
  },
});

export const headcountTool: ScopedTool = {
  schema: {
    name: "hr_headcount",
    description:
      "How many people work here: the company total broken down by team, or one team's " +
      "headcount, each split into permanent staff and contractors.",
    inputSchema: {
      type: "object",
      properties: teamParameter("headcount"),
      additionalProperties: false,
    },
  },
  read: (input): JsonValue => {
    if (input["team"] === undefined) return result(HR_DATASET.headcount);

    const team = teamIn(input);
    if (team === undefined) return NO_SUCH_TEAM;

    const row = headcountFor(team);
    return row === undefined ? NO_SUCH_TEAM : result(row);
  },
};

export const vacanciesTool: ScopedTool = {
  schema: {
    name: "hr_vacancies",
    description:
      "The roles currently open, for the whole company or for one team: the role, the team " +
      "hiring, when it opened, and how many days it has been open.",
    inputSchema: {
      type: "object",
      properties: teamParameter("vacancies"),
      additionalProperties: false,
    },
  },
  read: (input): JsonValue => {
    const all = HR_DATASET.vacancies;
    if (input["team"] === undefined) {
      return result({ openRoles: all.length, vacancies: all });
    }

    const team = teamIn(input);
    if (team === undefined) return NO_SUCH_TEAM;

    // A team with nothing open is answered, not refused: "no vacancies there"
    // is a fact, and a tool that errors instead leaves the model to guess.
    const open = Object.freeze(all.filter((vacancy) => vacancy.team === team));
    return result({ openRoles: open.length, vacancies: open });
  },
};

export const attritionTool: ScopedTool = {
  schema: {
    name: "hr_attrition",
    description:
      "Attrition for a quarter or the year to date: how many people joined and left, the " +
      "headcount either side of that, the attrition rate as a percentage, and the reasons " +
      "leavers gave.",
    inputSchema: {
      type: "object",
      properties: {
        period: {
          type: "string",
          enum: [...PERIODS],
          description: "Which period to report attrition for.",
        },
      },
      required: ["period"],
      additionalProperties: false,
    },
  },
  read: (input): JsonValue => {
    const period = periodIn(input);
    if (period === undefined) return NO_SUCH_PERIOD;

    const row = attritionFor(period);
    return row === undefined ? NO_SUCH_PERIOD : result(row);
  },
};

/**
 * Who a salary Question is about: any of a name, a role, and a team, and at
 * least one of them.
 *
 * The three travel together everywhere, so they are one thing rather than three
 * parameters. An empty one is the Question "everyone", which this tool does not
 * answer — see `ASK_FOR_SOMEONE`.
 */
type Roster = {
  readonly name?: string;
  readonly role?: string;
  readonly team?: Team;
};

/** A text filter, matched case-insensitively on part of the value. `undefined` when not asked for. */
const textIn = (input: JsonObject, key: string): string | undefined => {
  const value = input[key];
  return typeof value === "string" && value.trim() !== "" ? value.trim().toLowerCase() : undefined;
};

const matches = (employee: Employee, asked: Roster): boolean =>
  (asked.name === undefined || employee.name.toLowerCase().includes(asked.name)) &&
  (asked.role === undefined || employee.role.toLowerCase().includes(asked.role)) &&
  (asked.team === undefined || employee.team === asked.team);

export const salaryTool: ScopedTool = {
  schema: {
    name: "hr_salary",
    description:
      "What individuals are paid: annual base salary, with their role, team, and start date. " +
      "Ask by name for one person, or by role or team to compare pay across a group. At least " +
      "one of name, role, or team is required — this tool answers about the people you name, " +
      "not the roster in bulk.",
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "All or part of a person's name.",
        },
        role: {
          type: "string",
          description: "All or part of a role title, for example 'Senior Engineer'.",
        },
        ...teamParameter("pay"),
      },
      additionalProperties: false,
    },
  },
  read: (input): JsonValue => {
    const asked: Roster = {
      name: textIn(input, "name"),
      role: textIn(input, "role"),
      team: teamIn(input),
    };

    if (input["team"] !== undefined && asked.team === undefined) return NO_SUCH_TEAM;
    if (Object.values(asked).every((filter) => filter === undefined)) return ASK_FOR_SOMEONE;

    const found = Object.freeze(
      HR_DATASET.employees.filter((employee) => matches(employee, asked)),
    );

    return found.length === 0
      ? NO_ONE_NAMED
      : result({ currency, count: found.length, matches: found });
  },
};

/**
 * The HR Agent's whole tool set.
 *
 * This list is the isolation guarantee in its literal form: what an agent can
 * read is what is in this array, and adding to it is a visible edit rather than
 * a configuration change somewhere else. There is no finance tool in it, and
 * there is no tool instance here that also appears in `financeTools`.
 */
export const hrTools: readonly ScopedTool[] = [
  headcountTool,
  vacanciesTool,
  attritionTool,
  salaryTool,
];
