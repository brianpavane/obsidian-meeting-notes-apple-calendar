import test from "node:test";
import assert from "node:assert/strict";
import { appendToSection, continuityItems, sectionText } from "../src/sections";

const note = "---\ntitle: \"Sync\"\n---\n\n# Sync\n\n## Notes\n\n- \n\n## Decisions\n\n- Ship it\n\n## Action items\n\n- [ ] \n\n## Transcript\n\n";

test("sectionText ignores empty placeholder bullets and other sections", () => {
  assert.equal(sectionText(note, ["Notes"]), "");
  assert.equal(sectionText(note, ["decisions"]), "- Ship it");
  assert.equal(sectionText(note, ["Missing"]), "");
});

test("appendToSection replaces placeholders and adds to existing lists", () => {
  let out = appendToSection(note, ["Action items"], ["- [ ] Send deck"]);
  assert.match(out, /## Action items\n\n- \[ \] Send deck\n\n## Transcript/);
  out = appendToSection(out, ["Decisions"], ["- Hire Bob"]);
  assert.match(out, /## Decisions\n\n- Ship it\n- Hire Bob\n\n## Action items/);
  out = appendToSection(out, ["Transcript"], ["Alice: hi", "Bob: hello"]);
  assert.match(out, /## Transcript\n\nAlice: hi\nBob: hello\n$/);
});

test("appendToSection keeps a paragraph apart from existing text", () => {
  const out = appendToSection("## Meeting Summary\n\nFirst take.\n", ["Meeting Summary"], ["Second take."]);
  assert.equal(out, "## Meeting Summary\n\nFirst take.\n\nSecond take.\n");
});

test("appendToSection creates a missing section before another, or at the end", () => {
  const before = appendToSection("# T\n\n## Transcript\n\ntext\n", ["Meeting Summary"], ["Short."], ["Transcript"]);
  assert.equal(before, "# T\n\n## Meeting Summary\n\nShort.\n\n## Transcript\n\ntext\n");
  const atEnd = appendToSection("# T\n\nBody\n\n", ["Decisions"], ["- One"]);
  assert.equal(atEnd, "# T\n\nBody\n\n## Decisions\n\n- One\n");
});

test("headings in the frontmatter are not sections", () => {
  assert.equal(sectionText("---\n# Notes\n---\n## Notes\n\nreal\n", ["Notes"]), "real");
});

test("continuityItems reads the bullets under the continuity label", () => {
  const note = "---\ntitle: x\n---\n\n## Executive Summary\n\nWe met.\n\n---\n\n**Core Elements for Next Meeting Continuity:**\n- Confirm scope\n\n- [ ] Check certs\n* Ask [[Jane Doe]]\n\n## Next Steps\n\n- [ ] Other\n";
  assert.deepEqual(continuityItems(note), ["Confirm scope", "Check certs", "Ask [[Jane Doe]]"]);
  assert.deepEqual(continuityItems("## Executive Summary\n\nNo label here.\n"), []);
});
