export class LicenseError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = 'LicenseError';
    this.statusCode = statusCode;
  }
}
