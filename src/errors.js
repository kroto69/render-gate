// Defines stable CLI errors and exit codes.
// Remediation stays with expected failures for concise agent output.
export class GateError extends Error {
  constructor(code, message, remediation = '') {
    super(message);
    this.name = 'GateError';
    this.code = code;
    this.remediation = remediation;
  }
}
