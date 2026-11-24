// Defines consistent CLI errors and exit codes.
// Keeps user-facing remediation attached to each expected failure.
export class GateError extends Error {
  constructor(code, message, remediation) {
    super(message);
    this.name = 'GateError';
    this.code = code;
    this.remediation = remediation;
  }
}
