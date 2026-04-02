# DeployMate Roadmap

## Current Focus

- keep the admin and operations surface stable
- improve public presentation of the repository
- continue hardening the production security posture

## Near-Term

### Security hardening

- encrypt server credentials at rest
- tighten SSH host trust from `accept-new` toward pinned known hosts
- continue separating local Docker execution from general backend responsibilities

### Runtime confidence

- deepen automated tests around deployment creation, redeploy, delete, and diagnostics
- extend smoke coverage beyond admin UX into runtime workflows

### Product polish

- improve deployment detail ergonomics
- refine export/report workflows
- keep admin UI consistency high across pages

## Mid-Term

### Capability boundaries

- separate executor responsibilities more clearly
- make local Docker control an even narrower opt-in mode
- keep production defaults remote-only

### Recovery workflows

- evolve restore planning beyond dry-run into more structured import preparation
- keep destructive restore/apply behind stronger safeguards

## Long-Term

### Platform maturity

- external secret management
- richer observability and deployment metrics
- more formal multi-environment workflows

## Non-Goals Right Now

- pretending the project is already enterprise-complete
- adding broad platform complexity before safety and clarity improve
- shipping destructive restore flows without stronger guarantees
