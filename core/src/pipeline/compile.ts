import type { GeneratedSketch } from '../codegen/generate';
import { generateArduino } from '../codegen/generate';
import type { Flow } from '../graph/types';
import type { IrProgram } from '../ir/types';
import { buildIr } from '../ir/build';
import type { ValidationResult } from '../validation/types';
import { validateFlow } from '../validation/validate';

export interface CompileResult {
  ok: boolean;
  validation: ValidationResult;
  program?: IrProgram;
  sketch?: GeneratedSketch;
  /** Set when the flow is valid but cannot be compiled (should not happen in practice). */
  error?: string;
}

/**
 * The single entry point used by the UI before Live Test, Deploy and View Code:
 *
 *   Visual Graph -> Validator -> IR -> Arduino C++ (+ line map)
 *
 * Nothing else in the app is allowed to generate code.
 */
export function compileFlow(flow: Flow): CompileResult {
  const validation = validateFlow(flow);
  if (!validation.ok) {
    return { ok: false, validation };
  }
  const ir = buildIr(flow);
  if (!ir.ok) {
    return { ok: false, validation, error: ir.error };
  }
  return {
    ok: true,
    validation,
    program: ir.program,
    sketch: generateArduino(ir.program),
  };
}
