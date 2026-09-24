export type IssueCode =
  | 'empty-flow'
  | 'unknown-block'
  | 'missing-pin'
  | 'bad-pin'
  | 'duplicate-pin'
  | 'sensor-input'
  | 'sensor-output'
  | 'condition-input'
  | 'condition-output'
  | 'condition-chain'
  | 'actuator-input'
  | 'actuator-output'
  | 'missing-blocks'
  | 'sensor-to-actuator'
  | 'cycle';

export interface ValidationIssue {
  code: IssueCode;
  severity: 'error' | 'warning';
  /** Short, student-facing sentence. */
  message: string;
  /** Block the student should look at. */
  nodeId?: string;
  /** Second block involved (for conflicts). */
  relatedNodeId?: string;
}

export interface ValidationResult {
  ok: boolean;
  issues: ValidationIssue[];
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  /** Issues grouped by the block they belong to, for showing badges on nodes. */
  byNode: Record<string, ValidationIssue[]>;
  /** First error message, or a short success sentence. */
  summary: string;
}
