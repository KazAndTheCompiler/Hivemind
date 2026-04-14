You are the implementation agent for a local-first research repo called Multiagent_thinking.

Your job is to build a proper, reproducible testing environment for the emission-driven coordination architecture so the repository can produce shown, saved, testable outputs instead of only theory and partial experiments.

You are not here to redesign the project.
You are not here to write a paper.
You are here to implement the test harness, runners, fixtures, result capture, and evidence outputs.

You must obey this contract strictly.

1. Read the repository first and infer the current structure before changing anything.

2. Preserve the core thesis of the project:
   - supervision is the dominant hidden cost
   - emission reduces coordination overhead
   - TypeScript output is preferred over JSON because it improves compliance
   - the guard stack is part of the system, not optional

3. Do not rewrite the architecture docs unless needed to keep implementation and docs aligned.

4. Build a proper test environment that can run locally on a normal developer machine.

5. Prefer simple local tooling over clever abstractions.

6. Use TypeScript for the test harness unless the repo already has a stronger reason to use another runtime.

7. If there is already a `run.mjs` or similar runner, integrate with it or replace it cleanly only if replacement is clearly better.

8. Create a dedicated test harness area with a clean structure such as:
   - `harness/`
   - `fixtures/`
   - `results/`
   - `scripts/`
   - `src/guards/`
   - `src/schemas/`
   Adjust names only if the repo already has conventions.

9. Build the harness so it can run in at least these modes:
   - single-task baseline flow
   - single-task emission flow
   - multi-agent emission flow
   - provider-switching flow
   - long-loop flow

10. Make every run save machine-readable output artifacts to disk.

11. Save human-readable summaries too.

12. Each run must produce shown tested outputs, not only console logs.

13. The outputs must be easy to inspect after execution.

14. Create stable result files such as:
   - `results/<run-id>/raw/`
   - `results/<run-id>/normalized/`
   - `results/<run-id>/summary.md`
   - `results/<run-id>/metrics.json`
   - `results/<run-id>/events.jsonl`

15. Save prompts, raw model responses, normalized emissions, validation results, retry events, escalation events, token counts, and timing data.

16. Never discard raw outputs if they are useful for debugging compliance failures.

17. Implement a strict schema pipeline for emitted TypeScript structures.

18. If the repo already has schema definitions in markdown, convert them into executable TypeScript types and runtime validators.

19. Create executable definitions for at least:
   - ADR schema
   - Progress schema
   - Condensed emission schema
   - Verification schema
   - Escalation schema

20. Build a TypeScript guard that validates emitted TypeScript blocks structurally.

21. The TypeScript guard must not be fake.
   It must do more than string matching if possible.
   If full TypeScript compilation is too heavy, use lightweight parsing plus structural checks.

22. Build a semantic guard layer that rejects low-signal but structurally valid output.

23. The semantic guard must detect at minimum:
   - empty done lists without blockers
   - generic filler like “completed task”
   - missing file references
   - missing action verbs
   - placeholder/template outputs
   - weak signal density

24. Implement retry policy as executable code, not just docs.

25. Retry policy must be bounded.

26. Record retry count, retry reason, retry cost estimate, and final outcome.

27. Implement escalation rules as executable code, not just docs.

28. Escalation events must be captured in saved output.

29. Add a deterministic local “Ollama-style filter” stage that performs schema-to-schema condensation without freeform summarization.

30. This filter should use extraction and truncation rules, not creative rewriting.

31. The filter must cap output size by rule.

32. Build a baseline runner and an emission runner so both can be compared on the same task.

33. Build a comparison module that computes:
   - total tokens
   - frontier calls
   - worker calls
   - monitoring overhead
   - retry count
   - escalation count
   - compliance rate
   - average output size
   - pass/fail status

34. Produce a comparison table automatically in markdown.

35. Make the harness capable of using mocked model outputs when API access is unavailable.

36. Also make it capable of using real providers through environment variables when available.

37. Do not hardcode provider secrets.

38. Use environment variables and document them.

39. Add provider adapters in a minimal way.
   The harness should not depend on one provider only.

40. Implement these concrete test scenarios:
   - baseline single-task snake game comparison
   - failure loop with forced failing test
   - overlap conflict scenario where two agents want the same file
   - cross-file dependency scenario
   - 3-agent flow
   - provider-switching flow
   - 15-step loop

41. Ensure every scenario has a fixture or deterministic input source.

42. Ensure every scenario can be rerun.

43. Ensure every scenario emits saved evidence.

44. Add a “golden results” mechanism where appropriate so regressions can be spotted.

45. Add npm scripts or equivalent commands for:
   - run baseline
   - run emission
   - run all tests
   - run mocked tests
   - run real-provider tests
   - print latest summary

46. Make the README stronger by documenting exactly how to run the harness and where outputs appear.

47. Do not bloat the README with theory.
   Focus on running the system and inspecting evidence.

48. Keep implementation quality high:
   - clear file layout
   - minimal duplication
   - strong typing
   - small focused modules
   - useful error messages

49. Do not silently swallow parser failures or guard failures.

50. When a test case fails, save the failure state to disk and explain why in the summary artifact.

51. Add one top-level summary markdown output that a human can read quickly after the run.

52. That summary must include:
   - which scenarios ran
   - which passed
   - which failed
   - the key metrics
   - where the raw evidence lives

53. Add one machine-readable aggregate file across all scenarios.

54. Make sure the harness proves the core repo claim with evidence, not rhetoric.

55. Prefer finishing a smaller but fully working harness over leaving behind a large half-finished framework.

56. If you must choose, prioritize:
   - executable schemas
   - guard stack
   - saved outputs
   - reproducible scenarios
   - baseline vs emission comparison

57. After implementation, update docs only enough to reflect truth.
   Do not claim anything not actually tested.

58. At the end, output a concise change report containing:
   - files created
   - files modified
   - commands to run
   - what is now proven
   - what remains unproven

59. Also output a short “next test targets” section listing the most important follow-up experiments.

60. Final delivery contract:
   - the repo must contain a runnable testing environment
   - the testing environment must save shown tested outputs
   - the evidence must be inspectable without rereading model chats
   - the implementation must strengthen the project, not merely decorate it

Now execute the work.
Start by inspecting the repository structure and identifying the minimum set of files needed to build the harness cleanly.
Then implement the harness, guards, runners, scenarios, outputs, and docs.
Do not stop at planning.
Produce the code and the saved-output workflow.