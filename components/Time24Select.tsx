// Native <input type="time"> renders in 12-hour AM/PM format on some
// browsers (notably Safari/iOS) regardless of the `lang` attribute, which
// only reliably forces 24-hour display in Chromium. This dropdown renders
// the option text itself, so it's always 24-hour everywhere.
const TIME_OPTIONS = (() => {
  const options: string[] = [];
  for (let hour = 0; hour < 24; hour += 1) {
    for (let minute = 0; minute < 60; minute += 15) {
      options.push(`${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`);
    }
  }
  return options;
})();

export function Time24Select({
  value,
  onChange,
  disabled,
  ariaLabel,
  min,
  max,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  ariaLabel: string;
  min?: string;
  max?: string;
}) {
  const options = TIME_OPTIONS.filter((time) => (!min || time >= min) && (!max || time <= max));
  const hasCustomValue = Boolean(value) && !options.includes(value);

  return (
    <select aria-label={ariaLabel} disabled={disabled} value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">--:--</option>
      {hasCustomValue && <option value={value}>{value}</option>}
      {options.map((time) => <option key={time} value={time}>{time}</option>)}
    </select>
  );
}
