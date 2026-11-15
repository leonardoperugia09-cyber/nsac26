import test from "node:test";
import assert from "node:assert/strict";
import { triage, medicationAdvice } from "../../src/shared/triage.ts";
import { asksAboutData } from "../../src/shared/dataQuestion.ts";

test("emergencies in other wordings and languages are urgent", () => {
  for (const q of [
    "I vomited blood",
    "Crushing pressure in my chest spreading to my jaw",
    "Ho una forte emorragia che non si ferma",
    "Je ne peux plus respirer et j'ai mal à la poitrine",
    "I keep thinking about killing myself",
    "Suddenly my arm went weak and I can't speak properly",
    "Ich habe starke Schmerzen in der Brust und atme nicht richtig",
    "我吐血了",
  ])
    assert.equal(triage(q).urgent, true, q);
});

test("research and everyday wording is not an emergency or a medicine request", () => {
  for (const q of [
    "What is the evidence for melatonin use in space?",
    "Does microgravity affect wound healing?",
    "What studies show about bleeding gums in astronauts?",
    "Could my itchy rash be an allergic reaction?",
  ]) {
    assert.equal(triage(q).urgent, false, q);
    assert.equal(medicationAdvice(q), false, q);
  }
});

test("asking for medicine advice without naming a medicine is still refused", () => {
  assert.equal(medicationAdvice("What should I take for nausea?"), true);
  assert.equal(medicationAdvice("How much diphenhydramine for sleep?"), true);
});

test("questions about my own readings are data questions", () => {
  for (const q of [
    "Which of my signals are outside their band?",
    "Give me a summary of my health today.",
    "What do you know about me so far?",
  ])
    assert.equal(asksAboutData(q), true, q);
  assert.equal(asksAboutData("How does space radiation affect bone?"), false);
});
