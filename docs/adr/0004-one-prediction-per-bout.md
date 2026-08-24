---
status: accepted
---

# An Entry holds at most one Prediction per Bout

Winner, method and round are not independent events. "Fighter A wins" and "A wins by KO"
overlap heavily, so treating them as separate chained items whose Multipliers multiply pays
out as though the user predicted two things when they nearly predicted one — a systematic
overpayment users would find and farm. Some combinations are also impossible outright
("Decision" and "Round 2").

So a Prediction is a single compound answer for one Bout — required winner, optional method,
optional round — and an Entry may contain only one Prediction per Bout. Chaining happens
*across* Bouts. Adding method and round deepens a Prediction rather than lengthening the
chain. The admin prices the method and round Outcomes knowing they are multiplied onto a
winner pick, i.e. as conditional on the winner the user chose.

Rejected: pricing every full combination by hand (2 winners × 3 methods × up to 5 rounds is
30+ numbers per Bout, which nobody will maintain before every card).

## Consequences

- Not probabilistically pure — the conditional pricing is an admin's judgement, not a
  derived number. Acceptable because Coins have no monetary value.
- Validation must reject impossible Predictions: a round Outcome is only selectable
  alongside KO/TKO or Submission, never Decision.
