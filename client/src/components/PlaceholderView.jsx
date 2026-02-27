export function PlaceholderView({ language = 'en', title, description }) {
  return (
    <div className="placeholder-view">
      <h2 className="placeholder-title">{title}</h2>
      <p className="placeholder-desc">{description || 'This section is under development.'}</p>
    </div>
  );
}
