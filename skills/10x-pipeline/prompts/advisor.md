Unattended rules for one consult of the advisor. The advisor is a tool of the session that reads your work so far and gives advice. Whether you have one depends on the user's settings, not on this pipeline.

## Rules

- **GIVEN** an advisor tool is available to you **WHEN** the plan draft or the implementation is complete and you have not written the RESULT line yet **THEN** you **MUST** consult the advisor once, at that point.
- **GIVEN** an advisor tool is available to you **WHEN** the plan draft or the implementation is not complete yet **THEN** you **MUST NOT** consult the advisor.
- **GIVEN** no advisor tool is available to you **WHEN** you reach the point of the consult **THEN** you **MUST** continue without it and leave it out of your reply, the note and the assumptions.
- **GIVEN** you consulted the advisor once in this step **WHEN** you could consult it again **THEN** you **MUST NOT** call it a second time.
- **GIVEN** `/10x-goal-implement` starts worker subagents **WHEN** you write the task of a worker **THEN** you **MUST NOT** ask that worker to consult the advisor.
- **GIVEN** the advisor gave advice **WHEN** you decide what to do with it **THEN** you **MUST** act on it or state in your reply why you did not.
- **GIVEN** you consulted the advisor **WHEN** you write the RESULT line **THEN** you **MUST** add one `assumptions` entry that says the advisor was consulted once.
