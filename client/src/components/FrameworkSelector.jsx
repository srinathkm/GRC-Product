export function FrameworkSelector({ frameworks, value, onFrameworkChange }) {
  const selectValue = value ?? '';
  return (
    <div className="framework-selector">
      <label htmlFor="framework-select">Framework</label>
      <select
        id="framework-select"
        value={selectValue}
        onChange={(e) => onFrameworkChange?.(e.target.value)}
      >
        <option value="">Select framework…</option>
        {frameworks.map((f) => (
          <option key={f} value={f}>
            {f}
          </option>
        ))}
      </select>
    </div>
  );
}
