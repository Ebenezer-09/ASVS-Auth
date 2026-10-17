type AuthMessageProps = {
  kind: "success" | "error" | "info";
  message: string;
  onDismiss: () => void;
};

const messageStyles = {
  success: "alert-success",
  error: "alert-error",
  info: "alert-info",
};

export function AuthMessage({ kind, message, onDismiss }: AuthMessageProps) {
  if (!message) return null;

  return (
    <div
      className={`alert flex w-full items-start justify-between text-sm ${messageStyles[kind]}`}
      role={kind === "error" ? "alert" : "status"}
      aria-live={kind === "error" ? "assertive" : "polite"}
    >
      <span>{message}</span>
      <button
        type="button"
        className="btn btn-neutral btn-xs !text-white shrink-0"
        aria-label="Fermer le message"
        onClick={onDismiss}
      >
        ×
      </button>
    </div>
  );
}
