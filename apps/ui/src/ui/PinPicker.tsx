import { pinsForKinds } from '@ardudeck/core';
import type { PinId, PinKind } from '@ardudeck/core';

export interface PinPickerProps {
  label: string;
  kinds: PinKind[];
  value: PinId | undefined;
  onChange: (pin: PinId) => void;
  /** Pin id -> name of the block already using it. */
  used?: Record<string, string>;
}

export function PinPicker({ label, kinds, value, onChange, used = {} }: PinPickerProps) {
  const pins = pinsForKinds(kinds);
  return (
    <div className="field">
      <div className="field-label">{label}</div>
      <div className="pin-row">
        {pins.map((pin) => {
          const owner = used[pin];
          const active = value === pin;
          const classes = [
            'pin-chip',
            active ? 'pin-chip--active' : '',
            owner && !active ? 'pin-chip--used' : '',
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <button
              key={pin}
              type="button"
              className={classes}
              onClick={() => onChange(pin)}
              title={owner ? `Used by ${owner}` : undefined}
            >
              {pin}
            </button>
          );
        })}
        {value === undefined ? (
          <span className="pin-chip pin-chip--empty" aria-hidden="true">
            choose
          </span>
        ) : null}
      </div>
    </div>
  );
}
