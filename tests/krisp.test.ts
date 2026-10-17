import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { candidateRecordings, listRecordings, parseKrispHeader, preselect, splitStamp, transcriptBody, type Recording } from "../src/krisp";

const KRISP_SAMPLE = [
  "Zoom meeting - October 6, 2026 2-30-24 PM",
  "October 6, 2026 2:30:24 PM",
  "30m 9s",
  "",
  "",
  "You",
  "0:09 - Hi everyone.",
  "Speaker 0",
  "0:12 - Good afternoon.",
  "",
].join("\n");

test("parseKrispHeader reads Krisp's real header", () => {
  const header = parseKrispHeader(KRISP_SAMPLE);
  assert.equal(header.title, "Zoom meeting");
  assert.equal(header.start?.getTime(), new Date(2026, 9, 6, 14, 30, 24).getTime());
  assert.deepEqual(transcriptBody(KRISP_SAMPLE), ["You", "0:09 - Hi everyone.", "Speaker 0", "0:12 - Good afternoon."]);
});

test("splitStamp separates Krisp's date stamp from a title or folder name", () => {
  assert.deepEqual(splitStamp("Weekly 1-1 - October 6, 2026 10-00-40 AM"), {
    title: "Weekly 1-1",
    time: new Date(2026, 9, 6, 10, 0, 40),
  });
  assert.deepEqual(splitStamp("Planning"), { title: "Planning" });
});

test("parseKrispHeader reads the title and start time in common formats", () => {
  for (const line of [
    "2026-10-06 09:00",
    "October 6, 2026 9:00 AM",
    "Tuesday, October 6, 2026 at 9:00 AM",
    "Start time: Oct 6, 2026, 9:00am",
  ]) {
    const header = parseKrispHeader(`Weekly Sync\n${line}\n45:12\n\nSpeaker 1: hi`);
    assert.equal(header.title, "Weekly Sync", line);
    assert.equal(header.start?.getTime(), new Date(2026, 9, 6, 9, 0).getTime(), line);
    assert.equal(header.headerLines, 3, line);
  }
});

test("parseKrispHeader copes with labels and a missing time", () => {
  const header = parseKrispHeader("Title: Hallway chat\nDuration: 12:30\n\ntext");
  assert.equal(header.title, "Hallway chat");
  assert.equal(header.start, undefined);
  assert.equal(header.headerLines, 2);
});

test("transcriptBody drops the header and escapes heading-like lines", () => {
  assert.deepEqual(
    transcriptBody("Sync\n2026-10-06 09:00\n30:00\n\nAlice | 00:01\n# of tickets is high\n\n"),
    ["Alice | 00:01", "\\# of tickets is high"]
  );
});

const rec = (name: string, title: string, time: Date): Recording => ({ name, path: name, title, time });

const at = (h: number, m: number) => new Date(2026, 9, 6, h, m);
const names = (rs: Recording[]) => rs.map((r) => r.name);

test("candidateRecordings gives back-to-back meetings their own recording first", () => {
  const recordings = [
    rec("a", "Zoom meeting", new Date(2026, 9, 6, 14, 30, 24)),
    rec("b", "Zoom meeting", new Date(2026, 9, 6, 15, 0, 49)),
    rec("c", "Zoom meeting", new Date(2026, 9, 6, 15, 29, 58)),
  ];
  assert.deepEqual(names(candidateRecordings(recordings, { title: "Budget", start: at(14, 30), end: at(15, 0) })), ["a"]);
  assert.deepEqual(names(candidateRecordings(recordings, { title: "Hiring", start: at(15, 0), end: at(15, 30) })), ["b", "c"]);
  assert.deepEqual(names(candidateRecordings(recordings, { title: "Roadmap", start: at(15, 30), end: at(16, 0) })), ["c"]);
});

test("candidateRecordings prefers the usual join window but still offers late joins", () => {
  const meeting = { title: "Review", start: at(11, 0), end: at(12, 0) };
  const recordings = [
    rec("too-early", "Call", at(10, 48)),
    rec("early", "Call", at(10, 53)),
    rec("on-time", "Call", at(11, 6)),
    rec("late", "Call", at(11, 25)),
    rec("after", "Call", at(12, 0)),
  ];
  assert.deepEqual(names(candidateRecordings(recordings, meeting)), ["on-time", "early", "late"]);
});

test("candidateRecordings ranks a matching title first", () => {
  const meeting = { title: "Design Review", start: at(11, 0), end: at(12, 0) };
  const recordings = [rec("near", "Zoom meeting", at(11, 1)), rec("titled", "Design Review", at(11, 20))];
  assert.deepEqual(names(candidateRecordings(recordings, meeting)), ["titled", "near"]);
});

test("preselect never picks one recording for two double-booked meetings", () => {
  const a = rec("a", "Zoom meeting", at(11, 1));
  const b = rec("b", "Zoom meeting", at(11, 4));
  const meeting = { title: "x", start: at(11, 0), end: at(12, 0) };
  const picks = preselect([
    { file: "one", meeting, candidates: [a, b] },
    { file: "two", meeting, candidates: [a, b] },
    { file: "three", meeting, candidates: [a] },
  ]);
  assert.deepEqual(picks.map((r) => r?.name), ["a", "b", undefined]);
});

test("listRecordings reads each recording folder's transcript header", async () => {
  const root = await mkdtemp(join(tmpdir(), "krisp-test-"));
  try {
    await mkdir(join(root, "rec-1"));
    await writeFile(join(root, "rec-1", "transcript.txt"), "Weekly Sync\n2026-10-06 09:00\n30:00\n\nhello");
    await mkdir(join(root, "rec-2"));
    await writeFile(join(root, "rec-2", "transcript.txt"), "Design Review\n2026-10-07 11:00\n60:00\n\nhi");
    await mkdir(join(root, "Weekly 1-1 - October 5, 2026 10-00-40 AM"));
    await writeFile(join(root, "Weekly 1-1 - October 5, 2026 10-00-40 AM", "transcript.md"), "no header here");
    await mkdir(join(root, "empty"));
    await writeFile(join(root, "notes.txt"), "not a recording");

    const recordings = await listRecordings(root);
    assert.deepEqual(recordings.map((r) => [r.name, r.title]), [
      ["rec-2", "Design Review"],
      ["rec-1", "Weekly Sync"],
      ["Weekly 1-1 - October 5, 2026 10-00-40 AM", "no header here"],
    ]);
    assert.equal(recordings[1].time.getTime(), new Date(2026, 9, 6, 9).getTime());
    assert.equal(recordings[2].time.getTime(), new Date(2026, 9, 5, 10, 0, 40).getTime());
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
