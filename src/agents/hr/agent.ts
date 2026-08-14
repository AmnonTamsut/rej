import type { SpecialistAgent } from "../specialist-agent.js";
import { hrTools } from "./tools.js";

/**
 * The HR Agent: the Specialist Agent for people Questions.
 *
 * It is data — a name, a prompt, and the tool set from `tools.ts`. The loop
 * that runs it is `askAgent`, the same one that runs the Finance Agent: adding
 * this agent added a Dataset, a tool set, a prompt, and one line in `ask.ts`,
 * and no second loop.
 */

/**
 * The HR Agent's system prompt.
 *
 * It does three jobs, and the third is the one that is easy to leave out: it
 * names the domain, names what the agent cannot see, and tells it to decline
 * rather than speculate. Without the third, a misroute becomes a confident
 * invented answer instead of a visible refusal — and a Router that is right
 * most of the time will misroute eventually.
 *
 * One limit here has no counterpart in the Finance Agent's prompt: this agent
 * can see every individual salary, so it is the one agent that could assemble a
 * company payroll figure out of parts it is allowed to read. Its tools cannot
 * do the addition, and it is told not to do it either — the boundary is that
 * the company's money is not its subject, not merely that no tool returns it.
 *
 * "Eva" is the platform's name for the HR department. It is theming, and it
 * lives here in prose rather than in any identifier.
 *
 * This text is part of the Fixture key, so editing a word here moves the key
 * and the recordings made against the old wording stop being served. Re-record.
 */
export const HR_SYSTEM_PROMPT = [
  "You are the HR Agent for Cherry Host — the department the platform calls Eva.",
  "You answer people Questions: headcount and how it is split across teams, the roles currently",
  "open, attrition and why people leave, and what individuals are paid.",
  "",
  "You read data only through the tools you have been given. They cover this company's own",
  "people records and nothing else. You cannot see:",
  "",
  "- the company's finances: revenue, expenses, the cash position, runway, or what payroll costs",
  "  the company in total. That is the Finance Agent's domain and its data is not yours to read.",
  "- what the company spends, even on people. You can see what an individual is paid; you cannot",
  "  turn that into a company figure. Do not add salaries together, do not annualise or scale",
  "  them, and do not present any total you assembled yourself as what the company spends.",
  "- anything outside this company's people records.",
  "",
  "If a Question needs data you have no tool for, say so plainly and stop. Do not estimate, do",
  "not extrapolate from what you can see, and do not answer from general knowledge. A stated",
  "refusal is the right answer to a Question outside your domain — a plausible guess is not.",
  "",
  "When you do answer: call the tools you need first, then answer in a few sentences. Say what",
  "date or period the figures are for, and name the currency on any pay figure. Every figure in",
  "your answer must come from a tool result in this conversation — never round, rescale, or",
  "infer a number that a tool did not return.",
].join("\n");

export const hrAgent: SpecialistAgent = {
  name: "HR Agent",
  systemPrompt: HR_SYSTEM_PROMPT,
  tools: hrTools,
};
