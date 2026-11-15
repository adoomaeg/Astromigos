# The Astromigos idea

## The question we are exploring

A monitoring screen can display many measurements without helping its user understand the next decision. A developing problem may appear across several signals, such as sleep, heart-rate variability, activity, and cabin conditions. A user needs context, an explanation, and a clear handover to the people responsible for a response.

Astromigos explores a connected workflow:

**Observe the person. Understand the change. Review the next step. Record what happened. Follow up.**

We apply that workflow to an educational spaceflight simulation. The intended experience is a shared view of crew wellbeing that remains understandable when measurements are uncertain, several issues compete for attention, or a reply from Earth is delayed.

## Intended users

| User | Main question | Prototype support |
| --- | --- | --- |
| Crew member | What is changing for me, and what should I review next? | Individual view, check-in, plain-language status, and suggestions. |
| Crew medical officer | Who needs attention, what evidence is available, and what remains unresolved? | Crew selection, measurements, linked cases, history, and escalation. |
| Flight surgeon or mission-control reviewer | What happened, what was tried, and what needs review? | Trends, explanations, simulated messages, action logs, and handover tools. |
| Student, judge, or researcher | How does the concept behave under a controlled scenario? | Reproducible simulation, speed controls, provenance, tests, and documented limitations. |

These are design roles. The prototype does not provide authentication, professional credential checks, patient access controls, or an operational mission-control integration.

## The proposed value

### One connected story

An issue should not be an isolated notification. It should connect to its measurements, relevant body systems, suggested actions, recorded responses, and follow-up review. The tracker makes that relationship explicit without assuming that clicking a button fixes a problem.

### A person's own context

The engine compares synthetic measurements with a personal baseline and an activity context. A simulated workout should not be interpreted like a resting measurement. This is a demonstration of contextual monitoring, not proof that the chosen statistics are clinically appropriate.

### An understandable body view

The anatomy viewer provides a spatial explanation of the signals that are actually monitored. Its geometry is a shared reference atlas, not an individual's scan. Unmonitored structures remain reference-only; their presence must not suggest that the app measures every organ or can diagnose disease.

### Uncertainty that remains visible

Sensor loss, questionable readings, insufficient history, and incomplete forecasts need explicit states. Unknown information must not become reassurance. The prototype keeps missing data separate from normal results and shows limitations alongside derived information.

### An intentional medical handover

Suggested steps identify the responsible audience and whether the crew can act onboard or needs ground review. Critical conditions display “Seek medical attention ASAP.” The app does not invent a cure, recommend medication, or replace approved medical procedures.

## Example experience

An astronaut's simulated recovery signals drift over time. The overview identifies the affected profile and explains which signals changed. A user inspects the relevant body system and opens its associated case.

The case contains the triggering issue, available measurements, suggested steps, and a record of actions. A crew member can log an action and add observations. Later readings may move closer to the personal range, but the interface does not claim that the action caused recovery. After the monitored signals clear, a written review is required to resolve the case within the simulation.

Personal follow-up notes appear in that demonstration profile's medical history. This connects the immediate response with a longer narrative without claiming to hold an actual astronaut's medical record.

## Why Artemis II appears in the demo

The four public Artemis II crew identities give the presentation a recognizable mission context. Names, roles, and portraits are public identity information. Physiology, scenarios, medical-history records, messages, and health outcomes are synthetic and must not be associated with those individuals' real health.

The simulation clock, its synthetic mission-day history, and its scenario evolution are independent of the actual flight. The app does not receive live Orion telemetry or reconstruct an official mission record. The NASA insignia in the header is not evidence of sponsorship or endorsement.

## What this prototype demonstrates

- An integrated health-monitoring interaction and a shared data model.
- Controlled synthetic scenarios and statistical or rule-based explanations.
- The relationship between an alert, an action, measurements, and a follow-up review.
- Browser-based operation and static hosting without a server-side health database.
- Clear distinctions between simulated data, manually entered demo information, derived outputs, and public reference datasets.

## What it does not establish

It does not establish diagnostic accuracy, treatment effectiveness, acceptable clinical thresholds, operational readiness, privacy compliance for patient records, or certification for use in flight. Those would require defined requirements, clinical and domain review, representative data, security work, and independent evaluation beyond this demonstration.

## How we would judge the idea's progress

A useful evaluation would ask whether a participant can identify the affected person, distinguish a sensor issue from an unknown health state, explain why an alert appeared, locate the appropriate response, and understand why a case remains unresolved.

Future studies could measure task completion, misunderstanding of uncertainty, time to identify a critical escalation, and the completeness of a handover. These are proposed evaluation questions, not results already demonstrated by this repository.
