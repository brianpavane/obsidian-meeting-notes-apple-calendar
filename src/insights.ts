/**
 * @file insights.ts
 * @description The Meeting Insights note: analytics across every meeting
 * note — time spent, accounts and their sentiment, trending topics, the
 * people you meet, action item follow-through and meetings still without an
 * AI summary. Rebuilt by the "Open meeting insights" command.
 */

import { addDays, byPriorityThenDue, link, type Item, type TrackerMeeting } from "./tracker";

export const INSIGHTS_FILENAME = "Meeting Insights.md";

export const SENTIMENT_MARK: Record<string, string> = { positive: "🟢", neutral: "⚪", mixed: "🟡", negative: "🔴" };

/** A sentiment as its colored dot, or the sentiment itself if it isn't one of the four. */
export const sentimentMark = (s?: string) => (s ? SENTIMENT_MARK[s.toLowerCase()] ?? s : "");

const NEEDS_ATTENTION = new Set(["negative", "mixed"]);
const WEEKS = 12;
const BAR_MAX = 30;

const hours = (minutes: number) => `${Math.round(minutes / 6) / 10}`;
const bar = (n: number, max: number) => "█".repeat(max > BAR_MAX ? Math.round((n / max) * BAR_MAX) : n);
const percent = (n: number, of: number) => (of > 0 ? `${Math.round((n / of) * 100)}%` : "—");
const cell = (s: string) => s.replace(/\|/g, "\\|");

/** Case-insensitive grouping; each group is labeled with its first item's spelling. */
export function groupBy<T>(items: T[], key: (item: T) => string | undefined): Map<string, T[]> {
  const groups = new Map<string, { label: string; items: T[] }>();
  for (const item of items) {
    const label = key(item)?.trim();
    if (!label) continue;
    const k = label.toLowerCase();
    const group = groups.get(k) ?? { label, items: [] };
    group.items.push(item);
    groups.set(k, group);
  }
  return new Map([...groups.values()].map((g) => [g.label, g.items]));
}

const newestFirst = (a: TrackerMeeting, b: TrackerMeeting) => b.date.localeCompare(a.date);

/** Sentiment of the last `n` meetings that have one, oldest first, as dots. */
export function sentimentTrend(meetings: TrackerMeeting[], n = 5): string {
  return meetings.filter((m) => m.sentiment).sort(newestFirst).slice(0, n).reverse().map((m) => sentimentMark(m.sentiment)).join(" ");
}

function table(header: string[], rows: string[][], align: string[] = header.map(() => "---")): string[] {
  if (rows.length === 0) return ["Nothing here."];
  return [`| ${header.join(" | ")} |`, `| ${align.join(" | ")} |`, ...rows.map((r) => `| ${r.join(" | ")} |`)];
}

function counts(values: string[]): Array<[string, number]> {
  const byKey = groupBy(values, (v) => v);
  return [...byKey].map(([k, v]): [string, number] => [k, v.length]).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

/**
 * The insights note's content. `today` is YYYY-MM-DD; `updated` is shown as
 * the time it was built; `accountLink` turns an account name into a link to
 * its overview note.
 */
export function buildInsights(
  meetings: TrackerMeeting[],
  today: string,
  updated: string,
  accountLink: (account: string) => string = (a) => a
): string {
  const held = meetings.filter((m) => !m.skipped && m.date && m.date <= today).sort(newestFirst);
  const since = (days: number) => addDays(today, -(days - 1));
  const last30 = held.filter((m) => m.date >= since(30));
  const prev30 = held.filter((m) => m.date >= since(60) && m.date < since(30));
  const last90 = held.filter((m) => m.date >= since(90));
  const minutes = (ms: TrackerMeeting[]) => ms.reduce((n, m) => n + (m.minutes ?? 0), 0);

  const open: Item[] = meetings.flatMap((meeting) => meeting.openItems.map((meta) => ({ meta, meeting })));
  const overdue = open.filter((i) => i.meta.due && i.meta.due < today);
  const added30 = last30.reduce((n, m) => n + m.openItems.length + m.doneItems.length, 0);
  const done30 = last30.reduce((n, m) => n + m.doneItems.length, 0);
  const summarized30 = last30.filter((m) => m.summarized).length;

  // Meetings per week, Monday to Sunday, oldest first.
  const day = new Date(`${today}T12:00:00`).getDay();
  const monday = addDays(today, -((day + 6) % 7));
  const weeks = Array.from({ length: WEEKS }, (_, i) => addDays(monday, -7 * (WEEKS - 1 - i))).map((start) => {
    const inWeek = held.filter((m) => m.date >= start && m.date <= addDays(start, 6));
    return { start, count: inWeek.length, minutes: minutes(inWeek) };
  });
  const weekMax = Math.max(1, ...weeks.map((w) => w.count));

  // Time by category.
  const byCategory = [...groupBy(last30, (m) => m.category?.trim() || "Uncategorized")]
    .map(([k, ms]) => ({ k, count: ms.length, minutes: minutes(ms) }))
    .sort((a, b) => b.minutes - a.minutes || b.count - a.count);
  const totalMinutes = minutes(last30);

  // Accounts.
  const accounts = [...groupBy(last90, (m) => m.account)].map(([name, ms]) => {
    const sorted = [...ms].sort(newestFirst);
    const accountOpen = open.filter((i) => i.meeting.account?.trim().toLowerCase() === name.toLowerCase());
    return {
      name,
      count: ms.length,
      last: sorted[0].date,
      open: accountOpen.length,
      overdue: accountOpen.filter((i) => i.meta.due && i.meta.due < today).length,
      trend: sentimentTrend(ms),
      latestSentiment: sorted.find((m) => m.sentiment)?.sentiment,
      latestOutcome: sorted.find((m) => m.outcome)?.outcome,
    };
  }).sort((a, b) => b.last.localeCompare(a.last) || a.name.localeCompare(b.name));

  const attention = accounts.filter((a) =>
    NEEDS_ATTENTION.has(a.latestSentiment?.toLowerCase() ?? "") || a.latestOutcome?.toLowerCase() === "blocked");
  const quiet = accounts.filter((a) => a.last < since(30));
  const blocked = last30.filter((m) => m.outcome?.toLowerCase() === "blocked").sort(newestFirst);

  // Topics, trending: last 30 days against the 30 before.
  const topicsNow = counts(last30.flatMap((m) => m.keyTopics ?? []));
  const topicsBefore = new Map(counts(prev30.flatMap((m) => m.keyTopics ?? [])).map(([k, n]) => [k.toLowerCase(), n]));
  const trend = (now: number, before: number | undefined) =>
    before === undefined ? "🆕" : now > before ? "↑" : now < before ? "↓" : "→";

  // People.
  const people = [...groupBy(last30.flatMap((m) => [...new Set(m.people ?? [])].map((p) => ({ p, m }))), (x) => x.p)]
    .map(([name, xs]) => ({
      name,
      count: xs.length,
      last: xs.map((x) => x.m.date).sort().reverse()[0],
      open: open.filter((i) => i.meta.owner?.toLowerCase() === name.toLowerCase()).length,
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, 20);

  // Action items by owner.
  const done: Item[] = meetings.flatMap((meeting) => meeting.doneItems.map((meta) => ({ meta, meeting })));
  const owners = new Map<string, { open: number; overdue: number; done: number }>();
  const ownerOf = (i: Item) => i.meta.owner?.trim() || "Unassigned";
  for (const i of open) {
    const o = owners.get(ownerOf(i)) ?? { open: 0, overdue: 0, done: 0 };
    o.open++;
    if (i.meta.due && i.meta.due < today) o.overdue++;
    owners.set(ownerOf(i), o);
  }
  for (const i of done.filter((i) => (i.meta.doneOn ?? i.meeting.date) >= since(30))) {
    const o = owners.get(ownerOf(i)) ?? { open: 0, overdue: 0, done: 0 };
    o.done++;
    owners.set(ownerOf(i), o);
  }

  const oldest = [...open]
    .map((i) => ({ i, since: i.meta.created ?? i.meeting.date }))
    .filter((x) => x.since)
    .sort((a, b) => a.since.localeCompare(b.since) || byPriorityThenDue(a.i, b.i))
    .slice(0, 10);
  const age = (date: string) => Math.round((new Date(`${today}T12:00:00`).getTime() - new Date(`${date}T12:00:00`).getTime()) / 86_400_000);

  const unsummarized = held.filter((m) => m.date >= since(14) && !m.summarized).sort(newestFirst);

  const weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const perWeekday = weekdays.map((name, i) => ({
    name,
    count: last90.filter((m) => (new Date(`${m.date}T12:00:00`).getDay() + 6) % 7 === i).length,
  })).filter((d, i) => i < 5 || d.count > 0);
  const weekdayMax = Math.max(1, ...perWeekday.map((d) => d.count));

  const sentiments = counts(last90.flatMap((m) => (m.sentiment ? [m.sentiment] : [])));
  const outcomes = counts(last30.flatMap((m) => (m.outcome ? [m.outcome] : [])));

  return [
    "# Meeting Insights",
    "",
    `*Updated ${updated}. Refreshes each time you open it, or click ↻ at the top right. Edits here are overwritten. Category, account, sentiment, outcome and topics come from each meeting's properties, filled in by **Add AI reply**.*`,
    "",
    "## Last 30 days at a glance",
    "",
    "| Meetings | Hours | AI-summarized | Next steps added | Done | Overdue now |",
    "| ---: | ---: | ---: | ---: | ---: | ---: |",
    `| ${last30.length} | ${hours(totalMinutes)} | ${summarized30} (${percent(summarized30, last30.length)}) | ${added30} | ${done30} (${percent(done30, added30)}) | ${overdue.length} |`,
    "",
    "## Needs attention",
    "",
    ...(attention.length + blocked.length + quiet.length > 0
      ? [
        ...attention.map((a) => `- ${accountLink(a.name)} — latest ${[a.latestSentiment && `sentiment **${a.latestSentiment}**`, a.latestOutcome?.toLowerCase() === "blocked" && "outcome **Blocked**"].filter(Boolean).join(", ")} · ${a.last}`),
        ...blocked.map((m) => `- Blocked: ${link(m)} · ${m.date}${m.account ? ` · ${accountLink(m.account)}` : ""}`),
        ...quiet.map((a) => `- Gone quiet: ${accountLink(a.name)} — last met ${a.last} (${age(a.last)} days ago)`),
      ]
      : ["Nothing here."]),
    "",
    `## Meetings per week (last ${WEEKS} weeks)`,
    "",
    ...table(
      ["Week of", "Meetings", "Hours", ""],
      weeks.map((w) => [w.start, String(w.count), hours(w.minutes), bar(w.count, weekMax)]),
      ["---", "---:", "---:", "---"]
    ),
    "",
    "## Where the time goes (last 30 days)",
    "",
    ...table(
      ["Category", "Meetings", "Hours", "Share of time"],
      byCategory.map((c) => [cell(c.k), String(c.count), hours(c.minutes), percent(c.minutes, totalMinutes)]),
      ["---", "---:", "---:", "---:"]
    ),
    ...(totalMinutes > 0
      ? ["", "```mermaid", "pie showData title Hours by category", ...byCategory.filter((c) => c.minutes > 0).map((c) => `    "${c.k.replace(/"/g, "'")}" : ${hours(c.minutes)}`), "```"]
      : []),
    "",
    "## Accounts (last 90 days)",
    "",
    ...table(
      ["Account", "Meetings", "Last met", "Open items", "Overdue", "Sentiment (oldest → newest)", "Latest outcome"],
      accounts.map((a) => [accountLink(a.name).replace(/\|/g, "\\|"), String(a.count), a.last, String(a.open), String(a.overdue), a.trend, a.latestOutcome ?? ""]),
      ["---", "---:", "---", "---:", "---:", "---", "---"]
    ),
    "",
    "## Sentiment (last 90 days)",
    "",
    ...table(["Sentiment", "Meetings"], sentiments.map(([s, n]) => [`${sentimentMark(s)} ${s}`.trim(), String(n)]), ["---", "---:"]),
    "",
    "## Outcomes (last 30 days)",
    "",
    ...table(["Outcome", "Meetings"], outcomes.map(([o, n]) => [cell(o), String(n)]), ["---", "---:"]),
    "",
    "## Trending topics (last 30 days)",
    "",
    ...table(
      ["Topic", "Last 30 days", "30 days before", "Trend"],
      topicsNow.slice(0, 15).map(([t, n]) => [cell(t), String(n), String(topicsBefore.get(t.toLowerCase()) ?? 0), trend(n, topicsBefore.get(t.toLowerCase()))]),
      ["---", "---:", "---:", "---"]
    ),
    "",
    "## People you meet most (last 30 days)",
    "",
    ...table(
      ["Person", "Meetings", "Last met", "Open items they own"],
      people.map((p) => [cell(p.name), String(p.count), p.last, String(p.open)]),
      ["---", "---:", "---", "---:"]
    ),
    "",
    "## Action items by owner",
    "",
    ...table(
      ["Owner", "Open", "Overdue", "Done in the last 30 days"],
      [...owners].sort((a, b) => b[1].open - a[1].open || a[0].localeCompare(b[0])).map(([o, c]) => [cell(o), String(c.open), String(c.overdue), String(c.done)]),
      ["---", "---:", "---:", "---:"]
    ),
    "",
    "## Oldest open items",
    "",
    ...(oldest.length > 0
      ? oldest.map(({ i, since: from }) => `- ${i.meta.text}${i.meta.owner ? ` · ${i.meta.owner}` : ""} · open ${age(from)} days · ${link(i.meeting)}`)
      : ["Nothing here."]),
    "",
    "## Meetings without an AI summary (last 14 days)",
    "",
    ...(unsummarized.length > 0 ? unsummarized.map((m) => `- ${m.date} · ${link(m)}`) : ["Nothing here."]),
    "",
    "## Busiest days (last 90 days)",
    "",
    ...table(["Day", "Meetings", ""], perWeekday.map((d) => [d.name, String(d.count), bar(d.count, weekdayMax)]), ["---", "---:", "---"]),
    "",
  ].join("\n");
}
