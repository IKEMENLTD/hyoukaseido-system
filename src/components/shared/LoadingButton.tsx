'use client';

interface LoadingButtonProps {
  loading: boolean;
  disabled?: boolean;
  label: string;
  loadingLabel?: string;
  variant?: 'primary' | 'secondary' | 'danger';
  type?: 'button' | 'submit';
  onClick?: () => void;
  className?: string;
}

export default function LoadingButton({
  loading,
  disabled = false,
  label,
  loadingLabel,
  variant = 'primary',
  type = 'button',
  onClick,
  className = '',
}: LoadingButtonProps) {
  const baseStyles = 'px-4 py-2 text-xs font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2';

  const variantStyles = {
    primary: 'bg-[#3b82f6] hover:bg-[#2563eb] text-[#050505]',
    secondary: 'border border-[#333333] text-[#a3a3a3] hover:text-[#e5e5e5] hover:border-[#555555]',
    danger: 'bg-[#ef4444] hover:bg-[#dc2626] text-white',
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={loading || disabled}
      className={`${baseStyles} ${variantStyles[variant]} ${className}`}
    >
      {loading && (
        <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
          <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
        </svg>
      )}
      {loading ? (loadingLabel ?? label) : label}
    </button>
  );
}
