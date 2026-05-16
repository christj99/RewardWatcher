import { useState } from "react";

export function ConfirmButton({
  children,
  confirmLabel = "Confirm",
  onConfirm,
  className,
}: {
  children: React.ReactNode;
  confirmLabel?: string;
  onConfirm: () => void | Promise<void>;
  className?: string;
}) {
  const [isConfirming, setIsConfirming] = useState(false);

  if (isConfirming) {
    return (
      <span className="confirm-inline">
        <button
          type="button"
          className={className ?? "danger-button"}
          onClick={() => void onConfirm()}
        >
          {confirmLabel}
        </button>
        <button type="button" onClick={() => setIsConfirming(false)}>
          Cancel
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      className={className}
      onClick={() => setIsConfirming(true)}
    >
      {children}
    </button>
  );
}
