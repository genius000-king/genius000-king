export class CompileError extends Error {
  constructor(message, line = 1) {
    super(message);
    this.line = line;
    this.name = 'CompileError';
  }
}
