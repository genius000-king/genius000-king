export function IconButton({icon: Icon, label, onClick, active = false, className = '', ...props}) {
  return (
    <button
      className={`icon-button ${active ? 'active' : ''} ${className}`}
      onClick={onClick}
      title={label}
      aria-label={label}
      {...props}
    >
      <Icon size={17} strokeWidth={1.65} />
    </button>
  );
}
