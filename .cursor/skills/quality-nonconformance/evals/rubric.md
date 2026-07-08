# Quality & Non-Conformance Management — LLM Grading Rubric

## Purpose

This rubric guides an LLM grader in scoring agent responses to quality and non-conformance management evaluation scenarios. Each scenario contains 3–5 evaluation criteria with pass/fail rubric descriptions. The grader assigns a score to each criterion, and the weighted sum produces the scenario score.

---

## Grading Scale

| Rating | Score | Definition |
|---|---|---|
| **Pass** | 1.0 | Response demonstrates domain expertise. The recommended actions are what an experienced quality engineer in a regulated manufacturing environment would do. Correct regulatory frameworks are cited. NCR disposition logic, root cause methodology selection, CAPA lifecycle management, SPC interpretation, and sampling plan application are all accurate. The response reflects operational judgment — not just textbook quality engineering but awareness of how things actually play out with MRBs, suppliers, auditors, and customers. |
| **Partial** | 0.5 | Response is directionally correct but incomplete or imprecise. The agent identifies the general category of problem and suggests reasonable actions, but misses critical operational details, applies the wrong regulatory framework, selects an insufficient RCA methodology, omits a key stakeholder, or provides advice that would work in theory but cause problems in practice (e.g., initiating a CAPA for an isolated non-conformance that doesn't warrant one, or accepting a "retrain the operator" corrective action for a machining defect). |
| **Fail** | 0.0 | Response is incorrect, dangerously incomplete, or generic. The agent either misidentifies the type of non-conformance, applies the wrong disposition logic (e.g., use-as-is on a safety-critical aerospace part without customer approval), recommends actions that would harm regulatory standing or product safety, or provides advice so generic it could apply to any industry ("investigate the issue and implement improvements"). A response that sounds plausible to a layperson but would make a quality engineer in regulated manufacturing wince. |

### Grading Decision Guide

When choosing between adjacent ratings, use these tiebreakers:

**Pass vs. Partial:**
- Did the response identify the *single most critical action* for this scenario? If yes and the rest is reasonable, lean Pass.
- Would a quality manager reviewing this response need to add significant corrections before acting on it? If yes, Partial.

**Partial vs. Fail:**
- Does the response demonstrate awareness that this is a regulated manufacturing quality context (not generic business process improvement)? If not, Fail.
- Would following the response's advice cause active harm (regulatory violation, patient safety risk, customer relationship damage, data integrity issue)? If yes, Fail.
- Is the response merely incomplete but pointed in the right direction? Partial.

---

## Domain Expertise vs. Generic Response

The core distinction this rubric enforces is between responses grounded in quality engineering expertise in regulated manufacturing and responses that apply generic business quality logic to a manufacturing-shaped problem.

### What Constitutes Domain Expertise

An expert-level response demonstrates knowledge that can only come from working in quality engineering within regulated manufacturing. Specifically:

**1. NCR Lifecycle and Disposition Expertise**
- Knows the five disposition options (use-as-is, rework, repair, RTV, scrap) and the documentation requirements for each
- Understands that use-as-is in aerospace requires customer approval per AS9100 §8.7.1 — this is non-negotiable
- Recognizes that MRB disposition requires cross-functional participation (quality, engineering, manufacturing), not just quality sign-off
- Knows the difference between rework (bring to full conformance) and repair (make functional but not fully conforming) — and that repair requires additional justification
- Applies the rework-vs-scrap economic threshold (rework cost < 60% of replacement cost) without needing to be told

**2. Root Cause Analysis Methodology**
- Correctly selects the RCA method based on problem complexity — 5 Whys for simple, Ishikawa for multi-factor, 8D for customer-mandated, FTA for safety-critical
- Recognizes the red flags of inadequate RCA: "operator error" as root cause, "retrain" as corrective action, root cause that restates the problem
- Knows that each "why" in a 5 Whys must be verified with data, not stated as opinion
- Understands that the 8D methodology has gate requirements (D2 IS/IS NOT, D3 containment verification, D7 prevention distinct from D5 correction)
- Distinguishes between the cause of the defect and the cause of the detection escape — both must be addressed

**3. CAPA System Management**
- Correctly applies CAPA initiation triggers (recurrence, customer complaint, audit finding, field failure, trend signal)
- Understands the corrective action effectiveness hierarchy (elimination > engineering controls > administrative > training)
- Knows that effectiveness verification requires both implementation evidence and effectiveness data (process metrics showing improvement or non-recurrence)
- Recognizes that a CAPA closed without effectiveness verification is an audit finding waiting to happen
- Distinguishes between corrective action (addresses existing non-conformance) and preventive action (addresses potential non-conformance)
- Applies the correct effectiveness monitoring period (90 days minimum for process changes, adjusted for risk)

**4. Statistical Process Control Application**
- Correctly selects the chart type based on data type (variable vs. attribute) and subgroup structure
- Knows the Western Electric rules beyond Rule 1 — recognizes run signals (9 consecutive on one side), trends (6 consecutive increasing/decreasing), and stratification (14 alternating)
- Correctly interprets Cp/Cpk/Pp/Ppk and the relationships between them (Cp high + Cpk low = centering problem; Pp/Ppk < Cp/Cpk = between-subgroup variation)
- Understands the over-adjustment problem — reacting to common cause variation increases variation (tampering)
- Applies capability requirements correctly: IATF 16949 requires Cpk ≥ 1.33 for production, Ppk ≥ 1.67 for new processes
- Knows when to investigate vs. when to leave the process alone based on chart signals

**5. Regulatory Framework Application**
- Applies FDA 21 CFR 820 correctly to medical device quality situations — knows §820.90 (nonconforming product), §820.100 (CAPA), §820.198 (complaints), §820.72 (inspection equipment)
- Applies IATF 16949 correctly to automotive — knows PPAP requirements, control plan integration, customer notification requirements, 8D reporting expectations
- Applies AS9100 correctly to aerospace — knows customer approval requirements for disposition, FAI per AS9102, counterfeit prevention per §8.1.4, OASIS reporting
- Understands MDR (Medical Device Report) obligations — filing timelines, reporting thresholds, malfunction vs. injury vs. death categories
- Knows the distinction between 483 observations and warning letters, and the correct response approach for each

**6. Sampling Plan and Inspection Methodology**
- Correctly applies ANSI/ASQ Z1.4 (ISO 2859-1) — sample size code letters, accept/reject numbers, switching rules (normal → tightened → reduced)
- Knows AQL conventions: 0 for critical, 1.0-2.5 for major, 2.5-6.5 for minor
- Understands skip-lot qualification criteria and reversion triggers
- Distinguishes between AQL (producer protection) and LTPD (consumer protection) perspectives
- Knows when CoC reliance is acceptable vs. when physical inspection is required (new supplier = always inspect; critical dimension = always inspect regardless of supplier history)

### Common Indicators of Generic Responses

These patterns indicate the response lacks domain-specific expertise. Any single indicator is not disqualifying, but multiple indicators strongly suggest a Fail or low Partial:

**1. Wrong Abstraction Layer**
- Refers to NCR disposition as "deciding what to do with the parts" without using the correct terms (use-as-is, rework, repair, RTV, scrap)
- Calls the CAPA system a "problem-solving process" without referencing the specific lifecycle phases
- Describes SPC as "monitoring the process" without naming specific chart types, rules, or capability indices
- Suggests "checking quality standards" without naming the specific standard (FDA 21 CFR 820, IATF 16949, AS9100)
- Uses "quality management" generically rather than distinguishing between NCR, CAPA, audit response, and supplier management as separate workflows

**2. Missing Regulatory Awareness**
- Does not distinguish between FDA, automotive, and aerospace regulatory requirements — treats all manufacturing quality as the same
- Applies FDA requirements to an automotive situation or vice versa
- Does not know that aerospace use-as-is disposition requires customer approval
- Does not know that IATF 16949 requires Ppk ≥ 1.67 for new processes
- Does not recognize MDR reporting obligations for medical device non-conformances

**3. Incorrect Root Cause Logic**
- Accepts "operator error" or "human error" as a root cause
- Recommends "retrain the operator" as a primary corrective action for a process-related defect
- Uses 5 Whys for a multi-factor problem that clearly needs Ishikawa or FTA
- Does not distinguish between the cause of the defect and the cause of the detection escape
- States root causes as opinion without data verification

**4. Over-Reaction or Under-Reaction**
- Initiates a CAPA for an isolated, non-recurring, low-severity non-conformance (over-reaction)
- Does not initiate a CAPA for a recurring defect with safety implications (under-reaction)
- Stops production for a process that is within specification and control limits because one point is "near the limit" (over-reaction)
- Ignores a Western Electric Rule 2 signal because "all points are within limits" (under-reaction)
- Issues a formal SCAR for a single minor non-conformance from an otherwise excellent supplier (over-reaction)
- Takes no supplier action for a significant non-conformance affecting safety-critical parts (under-reaction)

**5. One-Dimensional Analysis**
- Addresses only the immediate NCR without considering systemic implications
- Focuses on the technical root cause without considering the detection system gap
- Provides a corrective action without an effectiveness verification plan
- Analyzes SPC data without connecting it to the control plan reaction plan
- Evaluates cost of quality without distinguishing prevention, appraisal, internal failure, and external failure

---

## Scoring Individual Criteria

For each criterion within a scenario, the grader should:

1. **Read the scenario context and task** to understand what the agent was asked to do.
2. **Read the criterion's pass and fail rubric descriptions** — these are specific to the scenario, not generic.
3. **Evaluate the agent's response** against both the pass and fail descriptions.
4. **Assign a rating:**
   - **Pass (1.0):** The response matches the pass description substantively. Minor wording differences are fine — the grader is evaluating whether the agent demonstrated the same operational judgment, not whether it used identical phrasing.
   - **Partial (0.5):** The response falls between the pass and fail descriptions. It captures some elements of the pass description but misses others, or gets the direction right but the details wrong.
   - **Fail (0.0):** The response matches the fail description, or is worse than the fail description, or does not address the criterion at all.

### Important Scoring Nuances

**Specificity Matters**
A response that says "investigate the non-conformance" is not the same as a response that says "perform a 5 Whys analysis starting with the physical evidence of tool wear on the insert, verify each 'why' with measurement data, and drive to the systemic gap in the tool change interval procedure." The first is generic; the second demonstrates process knowledge. Grade accordingly.

**Regulatory Accuracy Matters**
In regulated manufacturing, citing the wrong standard, applying the wrong filing timeline, or missing a mandatory reporting obligation is not a minor error — it's a compliance failure. A response that correctly handles the technical analysis but applies IATF 16949 requirements to a medical device situation (or vice versa) should receive Partial rather than Pass.

**The Effectiveness Hierarchy Matters**
When evaluating corrective actions, the grader should assess whether the recommended action is at an appropriate level on the effectiveness hierarchy (elimination > engineering controls > detection > administrative > training). A corrective action ranked 5 or 6 (administrative controls or training) when a rank 1-4 action is feasible indicates a lack of quality engineering depth. Grade accordingly.

**Omission Is Failure**
If a criterion's pass description includes 4 elements and the response covers 2 well but ignores 2, this is Partial — not Pass. The pass description represents the complete expert response.

**Over-Reaction Is as Wrong as Under-Reaction**
A response that halts production, initiates a full recall, and files with the FDA for a cosmetic defect on a non-critical dimension is as incorrect as one that ignores a safety-critical non-conformance. Correct severity assessment and proportionate response are fundamental to domain expertise.

**Practicality Test**
Would an experienced quality engineer in a regulated manufacturing environment read this response and say "yes, that's exactly what I'd do"? If yes, Pass. Would they say "that's roughly right but they're missing X"? Partial. Would they say "no, that would get us in trouble with [the auditor / the customer / the FDA]"? Fail.

---

## Grading Edge Cases

### When the Response Is Right for the Wrong Reasons

If the agent recommends the correct action but explains it using incorrect reasoning (e.g., recommends a CAPA but justifies it by citing the wrong standard clause), assign **Partial**. Correct actions with wrong reasoning suggest the agent may not replicate the correct behavior in novel situations.

### When the Response Adds Correct Information Not in the Rubric

If the agent provides additional relevant and correct information beyond what the pass rubric describes, this does not change the scoring — it's still a Pass. Do not penalize for additional correct content, even if it wasn't asked for, unless it contradicts other parts of the response.

### When the Response Contradicts Itself

If the agent states conflicting recommendations (e.g., "use the parts as-is" in one paragraph and "scrap the lot" in another), assign **Fail** for that criterion unless one recommendation is clearly framed as contingent on a condition.

### When the Scenario Has Evolved Since the Rubric Was Written

The rubric pass/fail descriptions reflect the expected best practice at the time of writing. If the agent references a legitimate recent change in regulations, industry standards, or technology that alters the expected response, the grader should give the benefit of the doubt and assign **Partial** at minimum, then flag the scenario for rubric review.

### When the Response Addresses a Different Aspect of the Problem

If the criterion asks about "root cause analysis" and the agent's response focuses entirely on "containment actions" (a different criterion), assign **Fail** for the root cause criterion even if the containment content is excellent. Each criterion is graded independently.

---

## Terminology Weighting

Domain-specific terminology usage is a signal, not a score. The grader should use terminology as follows:

**Terminology that signals expertise (positive signal, supports higher scores):**
- Correct use of: NCR, MRB, CAPA, SCAR, Cpk/Ppk, AQL, LTPD, Western Electric rules, poka-yoke, FMEA, 8D, fishbone/Ishikawa, FTA, use-as-is, RTV, control plan, PPAP, FAI, AS9102, CoC, gauge R&R, MSA, 21 CFR 820, 483, MDR, concession/deviation
- Correct differentiation between: corrective vs. preventive action, Cp vs. Cpk vs. Pp vs. Ppk, common vs. special cause, rework vs. repair, verification vs. validation, AQL vs. LTPD, attribute vs. variable data, tightened vs. normal vs. reduced inspection

**Terminology that signals generic knowledge (neutral — neither helps nor hurts):**
- Standard business terms used correctly: root cause analysis, continuous improvement, corrective action, quality management system
- General quality terms: defect rate, reject rate, customer complaint, audit, specification

**Terminology that signals misunderstanding (negative signal, supports lower scores):**
- Misuse of industry terms (e.g., calling Cpk "process performance" when it's "capability," confusing CAPA with NCR, using "tolerance" when they mean "specification")
- Using generic terms where specific terms exist (e.g., "quality review meeting" instead of "MRB," "inspection plan" instead of "control plan" in IATF context)
- Applying the wrong framework's terminology (e.g., "rejection rate" for SPC chart interpretation, "customer satisfaction survey" for COQ measurement)

**Important:** Terminology alone does not determine the score. An agent that uses all the right words but recommends the wrong actions should still fail. An agent that uses plain language but recommends the correct actions with proper operational judgment should still pass. Terminology is a supporting signal for borderline cases.

---

## Aggregate Interpretation

After scoring all criteria for all scenarios, the following aggregate benchmarks indicate capability levels:

| Aggregate Score | Interpretation |
|---|---|
| **≥ 85%** | Expert-level quality engineering capability. The agent can handle the full range of NCR disposition, RCA, CAPA management, SPC interpretation, and regulatory compliance with minimal human oversight. Suitable for production use in quality investigation support, CAPA drafting, and SPC analysis. |
| **70–84%** | Competent with supervision. The agent handles routine NCRs and straightforward CAPAs well but needs human review on complex multi-factor root causes, regulatory responses, and high-risk dispositions. Suitable for first-draft quality documents that a quality engineer reviews. |
| **50–69%** | Inconsistent. The agent demonstrates some quality knowledge but has significant gaps in regulatory awareness, RCA methodology, or SPC interpretation. May produce harmful advice on hard scenarios. Requires heavy human supervision and should not be used for regulatory documentation without thorough review. |
| **< 50%** | Insufficient domain expertise. The agent's responses are predominantly generic and would not be useful to a quality engineer in regulated manufacturing. Not suitable for any autonomous quality engineering tasks. |

### Difficulty-Adjusted Expectations

The scenario set is designed with a difficulty distribution:
- **Easy (~30%):** An agent with basic quality training should pass these. Failure on easy scenarios is a strong negative signal.
- **Medium (~35%):** An agent needs genuine quality engineering operational knowledge to pass these consistently. Partial scores are common and acceptable.
- **Hard (~35%):** These are designed to trip up agents without deep domain expertise. Even competent agents may score Partial on some hard scenarios. Consistent Pass on hard scenarios indicates true expert-level capability.

A capable agent should score ≥90% on easy, ≥70% on medium, and ≥50% on hard scenarios. An agent scoring below 50% on easy scenarios has fundamental gaps that disqualify it from the domain.
