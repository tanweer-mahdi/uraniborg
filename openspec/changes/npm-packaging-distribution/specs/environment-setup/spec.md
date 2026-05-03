## MODIFIED Requirements

### Requirement: Pinned Feynman Runtime Provisioning
The system SHALL require a compatible external Feynman installation and SHALL use that installation for review-side commands instead of provisioning a Uraniborg-managed standalone runtime under `~/.uraniborg/vendor/feynman`.

#### Scenario: Missing external prerequisite
- **WHEN** a user runs a Uraniborg command on a machine without a compatible Feynman installation
- **THEN** the system reports the missing prerequisite and explains how the user can install or expose Feynman

#### Scenario: Compatible external installation available
- **WHEN** a user runs a Uraniborg command and a compatible external Feynman installation is available
- **THEN** the system uses that installation for review-side operations instead of attempting to provision a bundled runtime

#### Scenario: Incompatible installation is rejected
- **WHEN** Uraniborg finds a Feynman installation that fails the required capability checks
- **THEN** the system reports the compatibility failure against that installation and does not treat it as ready

#### Scenario: Out-of-range but probe-valid installation is not rejected
- **WHEN** Uraniborg finds a Feynman installation outside the tested version range and the required compatibility probes succeed
- **THEN** the system reports a warning about the untested version and still treats the installation as compatible enough to proceed

### Requirement: Environment Health Checks
The system SHALL provide a `doctor` command that validates embedded review-side readiness, external Feynman compatibility, Uraniborg-owned revision configuration validity, revision runtime executability for the active profile, and filesystem readiness.

#### Scenario: Fully healthy environment
- **WHEN** the user runs `uraniborg doctor` and all dependencies are ready
- **THEN** the command reports success for app-home layout, review-side readiness, external Feynman compatibility, and executable revision runtime state for the active profile

#### Scenario: External Feynman prerequisite missing
- **WHEN** the user runs `uraniborg doctor` and no compatible Feynman installation can be discovered
- **THEN** the command reports the missing prerequisite and explains how the user can install or expose a compatible Feynman runtime

#### Scenario: External Feynman compatibility failure
- **WHEN** the user runs `uraniborg doctor` and a discovered Feynman installation fails the required capability checks
- **THEN** the command reports the compatibility failure against that installation rather than pretending a bundled runtime is available

#### Scenario: Compatible runtime with incomplete readiness remains distinguishable
- **WHEN** the user runs `uraniborg doctor` and the discovered Feynman installation is compatibility-valid but review models, AlphaXiv, or web-search readiness is incomplete
- **THEN** the command reports the compatibility status separately from those readiness issues instead of misclassifying the installation as incompatible
